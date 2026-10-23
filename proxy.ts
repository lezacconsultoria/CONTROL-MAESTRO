import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// PocketBase responde listas vacías (no error) con un token vencido, así que se revisa el vencimiento acá.
function expira(token: string) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)).exp * 1000 as number;
  } catch {
    return 0;
  }
}

const DIA = 24 * 60 * 60 * 1000;

// Sesión deslizante: mientras entres al menos una vez cada 7 días (vida del token) no se vence nunca.
export async function proxy(req: NextRequest) {
  const token = req.cookies.get("pb_token")?.value;
  const vence = token ? expira(token) : 0;
  if (!token || vence < Date.now()) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("pb_token");
    return res;
  }

  const res = NextResponse.next();
  if (vence - Date.now() < 6 * DIA) {
    try {
      const r = await fetch(`${process.env.PB_URL}/api/collections/users/auth-refresh`, {
        method: "POST",
        headers: { Authorization: token },
        cache: "no-store",
      });
      if (r.ok) {
        const { token: nuevo } = (await r.json()) as { token: string };
        res.cookies.set("pb_token", nuevo, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 30,
          path: "/",
        });
      }
    } catch {
      // sin red con PocketBase: se sigue con el token actual
    }
  }
  return res;
}

export const config = { matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"] };
