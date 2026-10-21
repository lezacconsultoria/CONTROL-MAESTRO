import "server-only";

// Habla con el motor de WhatsApp (el bridge de Hermes) por la red privada del servidor.
// El token vive solo en el servidor: nunca llega al navegador.

const MENSAJES: Record<number, string> = {
  400: "Faltan datos para enviar el mensaje.",
  401: "El panel no tiene el token correcto para hablar con el motor de WhatsApp.",
  404: "Ese contacto no existe en el motor de WhatsApp.",
  422: "Ese número no tiene WhatsApp.",
  503: "WhatsApp está desconectado en este momento. Probá en unos segundos.",
};

/** Envía un mensaje de WhatsApp como Leandro. Tira un Error con un texto claro si no se pudo. */
export async function enviarPorHermes(telefono: string, texto: string): Promise<void> {
  const base = process.env.HERMES_CONTROL_URL?.replace(/\/$/, "");
  const token = process.env.HERMES_CONTROL_TOKEN;
  if (!base || !token) throw new Error("El envío no está configurado en el servidor (faltan HERMES_CONTROL_URL y HERMES_CONTROL_TOKEN).");

  let res: Response;
  try {
    res = await fetch(`${base}/control/enviar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ telefono, texto }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    throw new Error("No pude comunicarme con el motor de WhatsApp. ¿Hermes está en marcha?");
  }
  if (res.ok) return;
  const datos = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(MENSAJES[res.status] ?? datos.error ?? `El motor de WhatsApp respondió con un error (${res.status}).`);
}
