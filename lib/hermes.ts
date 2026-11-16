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
  // Con varios números hay un motor por cada uno: HERMES_CONTROL_URL admite varias direcciones separadas por coma.
  // Cada motor solo conoce a sus contactos y responde 404 por los de otra línea; se prueba hasta que uno lo envíe.
  const bases = (process.env.HERMES_CONTROL_URL ?? "").split(",").map((u) => u.trim().replace(/\/$/, "")).filter(Boolean);
  const token = process.env.HERMES_CONTROL_TOKEN;
  if (!bases.length || !token) throw new Error("El envío no está configurado en el servidor (faltan HERMES_CONTROL_URL y HERMES_CONTROL_TOKEN).");

  let error = "";
  let alguno = false;
  for (const base of bases) {
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
      error ||= "No pude comunicarme con el motor de WhatsApp. ¿Hermes está en marcha?";
      continue;
    }
    alguno = true;
    if (res.ok) return;
    if (res.status === 404 && bases.length > 1) { error ||= MENSAJES[404]; continue; } // ese contacto es de otro número
    const datos = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(MENSAJES[res.status] ?? datos.error ?? `El motor de WhatsApp respondió con un error (${res.status}).`);
  }
  throw new Error(alguno ? error : error || "No pude comunicarme con el motor de WhatsApp.");
}
