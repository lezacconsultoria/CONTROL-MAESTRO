import { versionWhatsapp } from "@/lib/wa-version";

// La cookie de sesión es httpOnly: el navegador no puede hablar con PocketBase, así que pregunta acá.
export async function GET() {
  try {
    return Response.json({ version: await versionWhatsapp() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const sinSesion = /PocketBase (401|403)/.test((e as Error).message);
    return Response.json({ error: sinSesion ? "sin sesión" : "PocketBase no responde" }, { status: sinSesion ? 401 : 502 });
  }
}
