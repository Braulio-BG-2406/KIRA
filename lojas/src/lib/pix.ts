import { semAcentos } from "./texto";

// BR Code do Pix (padrão EMV do Banco Central), o "copia e cola" que qualquer banco lê.

function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, "0") + valor;
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido pelo campo 63 */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(texto, "utf8")) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function limpar(s: string, max: number): string {
  return semAcentos(s).replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, max).toUpperCase();
}

export function gerarPixCopiaECola(p: {
  chave: string;
  nome: string;
  cidade: string;
  valorCentavos?: number;
  /** identificador que aparece no extrato (até 25 letras/números) */
  txid?: string;
}): string {
  const txid = (p.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  let payload =
    campo("00", "01") +
    campo("26", campo("00", "br.gov.bcb.pix") + campo("01", p.chave.trim())) +
    campo("52", "0000") +
    campo("53", "986");
  if (p.valorCentavos && p.valorCentavos > 0) payload += campo("54", (p.valorCentavos / 100).toFixed(2));
  payload +=
    campo("58", "BR") +
    campo("59", limpar(p.nome, 25) || "LOJA") +
    campo("60", limpar(p.cidade, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";
  return payload + crc16(payload);
}
