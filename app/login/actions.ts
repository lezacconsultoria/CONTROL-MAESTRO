"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, PB_URL } from "@/lib/pb";

export async function login(_: string | null, form: FormData) {
  const res = await fetch(`${PB_URL}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: form.get("email"), password: form.get("password") }),
  });
  if (!res.ok) return "Email o contraseña incorrectos";
  const { token } = await res.json();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // el proxy renueva el token mientras se use la app
    path: "/",
  });
  redirect("/social");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
