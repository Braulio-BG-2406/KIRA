// O Brasil não tem horário de verão desde 2019: São Paulo é sempre UTC-3.
const FUSO = "America/Sao_Paulo";

/** "AAAA-MM-DD" no horário de São Paulo */
export function hojeSP(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(agora);
}

export function inicioDoDiaSP(agora = new Date()): Date {
  return new Date(`${hojeSP(agora)}T00:00:00-03:00`);
}

export function inicioDoMesSP(agora = new Date()): Date {
  return new Date(`${hojeSP(agora).slice(0, 7)}-01T00:00:00-03:00`);
}

/** início do dia "AAAA-MM-DD" em SP */
export function diaSP(dia: string): Date {
  return new Date(`${dia}T00:00:00-03:00`);
}

export function somarDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * 86_400_000);
}

export function formatarData(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const data = typeof d === "string" && d.length === 10 ? diaSP(d) : new Date(d);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO }).format(data);
}

export function formatarDataHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" }).format(new Date(d));
}
