import { describe, expect, it } from "vitest";
import { crc16, gerarPixCopiaECola } from "@/lib/pix";
import { opcoesDeFrete } from "@/lib/frete";
import { aplicarCupom } from "@/lib/cupom";
import { lerReais, formatarReais } from "@/lib/dinheiro";
import { criarSlug } from "@/lib/texto";
import { inicioDoDiaSP, hojeSP } from "@/lib/datas";
import { FRETE_PADRAO, type Cupom } from "@/db/schema";
import { lerCsv, csvParaObjetos, gerarCsv } from "@/lib/csv";

describe("pix", () => {
  it("usa o CRC16-CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("confere com o exemplo do manual do Banco Central", () => {
    const semCrc =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(semCrc)).toBe("1D3D");
    const codigo = gerarPixCopiaECola({ chave: "123e4567-e12b-12d1-a456-426655440000", nome: "Fulano de Tal", cidade: "BRASILIA" });
    expect(codigo.slice(0, -4)).toBe(semCrc.replace("Fulano de Tal", "FULANO DE TAL"));
  });

  it("inclui valor e txid e tira acentos", () => {
    const codigo = gerarPixCopiaECola({ chave: "loja@exemplo.com", nome: "Infinite Semijóias", cidade: "São Paulo", valorCentavos: 12990, txid: "PED-42" });
    expect(codigo).toContain("5406129.90");
    expect(codigo).toContain("5918INFINITE SEMIJOIAS");
    expect(codigo).toContain("6009SAO PAULO");
    expect(codigo).toContain("0505PED42");
    expect(codigo.slice(-4)).toBe(crc16(codigo.slice(0, -4)));
  });
});

describe("frete", () => {
  const config = {
    ...FRETE_PADRAO,
    entrega: { ...FRETE_PADRAO.entrega, valorPadraoCentavos: 2500, porUF: { SP: 1200 }, gratisAcimaCentavos: 20000 },
  };
  it("usa o valor da UF ou o padrão", () => {
    expect(opcoesDeFrete(config, "SP", 5000)[0].valorCentavos).toBe(1200);
    expect(opcoesDeFrete(config, "BA", 5000)[0].valorCentavos).toBe(2500);
  });
  it("dá frete grátis acima do mínimo", () => {
    expect(opcoesDeFrete(config, "BA", 20000)[0]).toMatchObject({ valorCentavos: 0, descricao: "Entrega (frete grátis)" });
  });
  it("sem UF válida só oferece retirada", () => {
    expect(opcoesDeFrete(config, null, 5000).map((o) => o.metodo)).toEqual(["retirada"]);
    expect(opcoesDeFrete(config, "XX", 5000).map((o) => o.metodo)).toEqual(["retirada"]);
  });
});

describe("cupom", () => {
  const base: Cupom = {
    id: 1, lojaId: 1, codigo: "BEMVINDA", tipo: "percentual", valor: 10, minimoCentavos: 0,
    validoAte: null, limiteUsos: null, usos: 0, ativo: true, criadoEm: new Date(),
  };
  it("calcula percentual e fixo", () => {
    expect(aplicarCupom(base, 10000)).toEqual({ ok: true, descontoCentavos: 1000 });
    expect(aplicarCupom({ ...base, tipo: "fixo", valor: 1500 }, 10000)).toEqual({ ok: true, descontoCentavos: 1500 });
  });
  it("nunca passa do subtotal", () => {
    expect(aplicarCupom({ ...base, tipo: "fixo", valor: 50000 }, 10000)).toEqual({ ok: true, descontoCentavos: 10000 });
  });
  it("recusa vencido, esgotado, inativo e abaixo do mínimo", () => {
    expect(aplicarCupom({ ...base, validoAte: "2020-01-01" }, 10000).ok).toBe(false);
    expect(aplicarCupom({ ...base, limiteUsos: 3, usos: 3 }, 10000).ok).toBe(false);
    expect(aplicarCupom({ ...base, ativo: false }, 10000).ok).toBe(false);
    expect(aplicarCupom({ ...base, minimoCentavos: 20000 }, 10000).ok).toBe(false);
  });
});

describe("dinheiro e texto", () => {
  it("lê valores no formato brasileiro", () => {
    expect(lerReais("1.234,56")).toBe(123456);
    expect(lerReais("R$ 12")).toBe(1200);
    expect(lerReais("12.5")).toBe(1250);
    expect(lerReais("abc")).toBeNull();
    expect(lerReais("")).toBeNull();
  });
  it("formata em reais", () => {
    expect(formatarReais(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
  it("cria slugs sem acento", () => {
    expect(criarSlug("Anel Solitário Ródio  18k!")).toBe("anel-solitario-rodio-18k");
  });
  it("usa o dia de São Paulo", () => {
    const quaseMeiaNoiteSP = new Date("2026-03-10T02:30:00Z"); // 23:30 do dia 9 em SP
    expect(hojeSP(quaseMeiaNoiteSP)).toBe("2026-03-09");
    expect(inicioDoDiaSP(quaseMeiaNoiteSP).toISOString()).toBe("2026-03-09T03:00:00.000Z");
  });
});


describe("csv", () => {
  it("lê ; com aspas, quebra de linha e BOM", () => {
    const t = '﻿Nome;Preço;Descrição\r\n"Anel; Ouro";79,90;"linha 1\nlinha ""2"""\r\nBrinco;49,90;\r\n';
    expect(lerCsv(t)).toEqual([["Nome", "Preço", "Descrição"], ["Anel; Ouro", "79,90", 'linha 1\nlinha "2"'], ["Brinco", "49,90", ""]]);
  });
  it("detecta vírgula e normaliza o cabeçalho", () => {
    expect(csvParaObjetos("Nome,Preço De,SKU\nColar,10.5,C1")).toEqual([{ nome: "Colar", preco_de: "10.5", sku: "C1" }]);
  });
  it("gera CSV que volta igual", () => {
    const linhas = [["a;b", 'diz "oi"', 3]];
    expect(lerCsv(gerarCsv(linhas))).toEqual([["a;b", 'diz "oi"', "3"]]);
  });
});
