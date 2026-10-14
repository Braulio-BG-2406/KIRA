"use client";

export function SeletorLoja({ lojas, atual }: { lojas: { slug: string; nome: string }[]; atual: string }) {
  return (
    <select
      id="loja"
      name="loja"
      defaultValue={atual}
      className="campo font-medium"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {lojas.map((l) => (
        <option key={l.slug} value={l.slug}>
          {l.nome}
        </option>
      ))}
    </select>
  );
}
