"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-8">
        <h1 className="font-display text-2xl font-extrabold">
          Control <span className="text-accent">Maestro</span>
        </h1>
        <input name="email" type="email" placeholder="Email" required
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
        <input name="password" type="password" placeholder="Contraseña" required
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={pending}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
