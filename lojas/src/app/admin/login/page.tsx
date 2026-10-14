import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { FormEntrar } from "./FormEntrar";

export const metadata = { title: "Entrar | Painel", robots: { index: false } };

export default async function Login() {
  if (await usuarioAtual()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">Painel das lojas</h1>
        <p className="mb-6 text-sm text-stone-500">Infinite Semijoias e BG Imports</p>
        <FormEntrar />
      </div>
    </main>
  );
}
