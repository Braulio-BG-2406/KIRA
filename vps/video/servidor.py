#!/usr/bin/env python3
# Kira — serviço de vídeo: coloca uma faixa com texto (por exemplo, o preço) num vídeo para os Reels.
# Roda num contêiner ao lado do n8n e só o n8n fala com ele, pela rede interna do Docker (nenhuma porta aberta na
# internet). Usa só a biblioteca padrão do Python e o ffmpeg.
#
#   GET  /saude                               -> "ok"
#   POST /faixa?texto=...&cor=amarelo&altura=70&letra=4.5   (corpo: o vídeo)  -> o vídeo MP4 com a faixa
#
# texto: até 2 linhas (separe com "|" ou quebra de linha), até 40 caracteres cada.
# cor: amarelo (padrão), vermelho, preto ou branco.
# altura: onde fica o centro da faixa, em % da altura do vídeo (40 a 95; padrão 70). No Reels, o Instagram cobre
# a parte de baixo do vídeo com o nome da conta e a legenda; 70% fica logo acima dessa área.
# letra: tamanho da letra, em % da altura do vídeo (2 a 7; padrão 4.5). A letra encolhe se o texto não couber.
# O vídeo sai em H.264 + AAC, com o índice no começo do arquivo (o formato que o Instagram pede).
import json
import os
import subprocess
import tempfile
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORTA = int(os.environ.get('PORTA', '8080'))
LIMITE_BYTES = 25 * 1024 * 1024
LIMITE_SEGUNDOS = 300
MAX_LINHAS = 2
MAX_CARACTERES = 40
FONTES = [
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]
CORES = {
    'amarelo': ('0xFFD400@0.95', 'black'),
    'vermelho': ('0xD7001A@0.92', 'white'),
    'preto': ('black@0.72', 'white'),
    'branco': ('white@0.92', 'black'),
}
# Um vídeo por vez: a VPS é pequena e o n8n também precisa de processador.
FILA = threading.Semaphore(1)


class Recusa(Exception):
    pass


def fonte():
    for f in FONTES:
        if os.path.exists(f):
            return f
    for pasta, _, arquivos in os.walk('/usr/share/fonts'):
        if 'DejaVuSans-Bold.ttf' in arquivos:
            return os.path.join(pasta, 'DejaVuSans-Bold.ttf')
    raise Recusa('fonte não encontrada no servidor')


def linhas_do_texto(texto):
    partes = [p.strip() for p in texto.replace('\r', '').replace('|', '\n').split('\n')]
    partes = [' '.join(p.split()) for p in partes if p.strip()]
    if not partes:
        raise Recusa('faltou o texto da faixa')
    if len(partes) > MAX_LINHAS:
        raise Recusa(f'a faixa aceita até {MAX_LINHAS} linhas')
    for p in partes:
        if len(p) > MAX_CARACTERES:
            raise Recusa(f'cada linha da faixa aceita até {MAX_CARACTERES} caracteres')
    return partes


def medidas(caminho):
    r = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', caminho],
        capture_output=True, text=True, timeout=60,
    )
    if r.returncode != 0:
        raise Recusa('não consegui ler o vídeo (formato não reconhecido)')
    fluxos = json.loads(r.stdout or '{}').get('streams', [])
    video = next((s for s in fluxos if s.get('codec_type') == 'video'), None)
    if not video or not video.get('width') or not video.get('height'):
        raise Recusa('o arquivo não tem vídeo')
    tem_audio = any(s.get('codec_type') == 'audio' for s in fluxos)
    return int(video['width']), int(video['height']), tem_audio


def montar_filtro(largura, altura, linhas, cor, centro_pct, pasta, letra_pct=4.5):
    caixa, cor_texto = CORES.get(cor, CORES['amarelo'])
    # Largura e altura pares (o H.264 exige); a letra encolhe para a linha mais longa caber em 90% da largura.
    maior = max(len(l) for l in linhas)
    tamanho = int(min(altura * letra_pct / 100, (largura * 0.90) / (0.62 * maior)))
    tamanho = max(tamanho, 14)
    espaco = int(tamanho * 0.35)
    margem = int(tamanho * 0.6)
    altura_caixa = len(linhas) * tamanho + (len(linhas) - 1) * espaco + 2 * margem
    topo = int(altura * centro_pct / 100 - altura_caixa / 2)
    topo = max(0, min(topo, altura - altura_caixa))
    partes = [f'scale=trunc(iw/2)*2:trunc(ih/2)*2', f'drawbox=x=0:y={topo}:w=iw:h={altura_caixa}:color={caixa}:t=fill']
    for i, linha in enumerate(linhas):
        arquivo = os.path.join(pasta, f'linha{i}.txt')
        with open(arquivo, 'w', encoding='utf-8') as f:
            f.write(linha)
        y = topo + margem + i * (tamanho + espaco)
        partes.append(
            f"drawtext=fontfile={fonte()}:textfile={arquivo}:expansion=none:fontcolor={cor_texto}"
            f":fontsize={tamanho}:x=(w-text_w)/2:y={y}"
        )
    return ','.join(partes)


def aplicar_faixa(dados, texto, cor='amarelo', centro_pct=70, letra_pct=4.5):
    linhas = linhas_do_texto(texto)
    if cor not in CORES:
        raise Recusa('cor inválida: use amarelo, vermelho, preto ou branco')
    centro_pct = max(40, min(95, int(centro_pct)))
    letra_pct = max(2.0, min(7.0, float(letra_pct)))
    with tempfile.TemporaryDirectory() as pasta:
        entrada = os.path.join(pasta, 'entrada')
        saida = os.path.join(pasta, 'saida.mp4')
        with open(entrada, 'wb') as f:
            f.write(dados)
        largura, altura, tem_audio = medidas(entrada)
        filtro = montar_filtro(largura, altura, linhas, cor, centro_pct, pasta, letra_pct)
        cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', entrada]
        if not tem_audio:
            # Vídeo sem som ganha um áudio mudo: o Instagram recusa alguns Reels sem faixa de áudio.
            cmd += ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest']
        cmd += ['-map', '0:v:0', '-map', '0:a:0' if tem_audio else '1:a:0', '-vf', filtro,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
                '-movflags', '+faststart', saida]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=LIMITE_SEGUNDOS)
        if r.returncode != 0 or not os.path.exists(saida):
            raise Recusa('o ffmpeg não conseguiu montar o vídeo: ' + (r.stderr or '').strip()[-300:])
        with open(saida, 'rb') as f:
            return f.read()


class Atendente(BaseHTTPRequestHandler):
    server_version = 'kira-video'

    def log_message(self, formato, *args):
        # Registra só método, caminho (sem o texto da faixa) e código.
        print(f'{self.command} {urllib.parse.urlsplit(self.path).path} {args[1] if len(args) > 1 else ""}', flush=True)

    def responder(self, codigo, corpo, tipo='application/json; charset=utf-8'):
        if isinstance(corpo, (dict, list)):
            corpo = json.dumps(corpo, ensure_ascii=False).encode('utf-8')
        elif isinstance(corpo, str):
            corpo = corpo.encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        if urllib.parse.urlsplit(self.path).path == '/saude':
            return self.responder(200, 'ok', 'text/plain; charset=utf-8')
        self.responder(404, {'erro': 'caminho não encontrado'})

    def do_POST(self):
        partes = urllib.parse.urlsplit(self.path)
        if partes.path != '/faixa':
            return self.responder(404, {'erro': 'caminho não encontrado'})
        tamanho = int(self.headers.get('Content-Length') or 0)
        if tamanho <= 0:
            return self.responder(400, {'erro': 'mande o vídeo no corpo do pedido'})
        if tamanho > LIMITE_BYTES:
            return self.responder(413, {'erro': 'vídeo maior que 25 MB'})
        dados = self.rfile.read(tamanho)
        q = urllib.parse.parse_qs(partes.query)
        texto = (q.get('texto') or [''])[0]
        cor = (q.get('cor') or ['amarelo'])[0].strip().lower() or 'amarelo'
        try:
            centro = int(float((q.get('altura') or ['70'])[0]))
        except ValueError:
            centro = 70
        try:
            letra = float((q.get('letra') or ['4.5'])[0].replace(',', '.'))
        except ValueError:
            letra = 4.5
        try:
            with FILA:
                video = aplicar_faixa(dados, texto, cor, centro, letra)
        except Recusa as e:
            return self.responder(400, {'erro': str(e)})
        except subprocess.TimeoutExpired:
            return self.responder(504, {'erro': 'o vídeo demorou demais para ficar pronto'})
        self.responder(200, video, 'video/mp4')


if __name__ == '__main__':
    print(f'kira-video ouvindo na porta {PORTA}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORTA), Atendente).serve_forever()
