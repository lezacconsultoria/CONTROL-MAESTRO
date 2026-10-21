import { pb, type List, type WaContacto, type WaMensaje } from "@/lib/pb";
import { diaAR, horaAR } from "@/lib/fecha";
import { AUTOR, ESTADO_CONTACTO, escapar, fechaHora, verTelefono } from "@/lib/wa";
import AutoActualizar from "@/components/AutoActualizar";
import { versionWhatsapp } from "@/lib/wa-version";
import BotonAgente from "../BotonAgente";
import CajaMensaje from "./CajaMensaje";
import HistorialScroll from "./HistorialScroll";

const ID = /^[a-z0-9]{15}$/;

function etiquetaDia(iso: string) {
  const [a, m, d] = diaAR(iso).split("-");
  return `${d}/${m}/${a}`;
}

export default async function Chats({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const elegido = sp.c && ID.test(sp.c) ? sp.c : "";

  const filtro = ['ultimo_mensaje!=""', ...(q ? [`(nombre~"${escapar(q)}" || empresa~"${escapar(q)}" || telefono~"${escapar(q.replace(/\D/g, "") || q)}")`] : [])].join(" && ");
  // La huella se toma antes de leer los datos: si algo cambia mientras se arma la página, el próximo sondeo lo detecta.
  const version = await versionWhatsapp();
  const [lista, recientes, contacto, mensajes] = await Promise.all([
    pb<List<WaContacto>>(`collections/wa_contactos/records?perPage=100&sort=-ultimo_mensaje&filter=${encodeURIComponent(filtro)}`),
    pb<List<WaMensaje>>("collections/wa_mensajes/records?perPage=300&sort=-created&fields=contacto,texto,direccion,created"),
    elegido ? pb<WaContacto>(`collections/wa_contactos/records/${elegido}?expand=campana`).catch(() => null) : Promise.resolve(null),
    elegido
      ? pb<List<WaMensaje>>(`collections/wa_mensajes/records?perPage=200&sort=-created&filter=${encodeURIComponent(`contacto="${elegido}"`)}`)
      : Promise.resolve(null),
  ]);

  // Último mensaje de cada contacto, para la vista previa de la lista.
  const ultimo = new Map<string, WaMensaje>();
  for (const m of recientes.items) if (!ultimo.has(m.contacto)) ultimo.set(m.contacto, m);

  const historial = [...(mensajes?.items ?? [])].reverse();
  const href = (id: string) => `?${new URLSearchParams({ ...(q ? { q } : {}), c: id })}`;

  return (
    <div>
      <AutoActualizar inicial={version} />
      <h1 className="font-display text-2xl font-bold">Chats</h1>
      <p className="mt-1 text-sm text-muted">Conversaciones de WhatsApp con los contactos.</p>

      <div className="mt-5 grid h-[calc(100vh-11rem)] min-h-[480px] gap-4 lg:grid-cols-[320px_1fr]">
        <section className="flex min-h-0 flex-col rounded-lg border border-line bg-surface">
          <form className="border-b border-line p-3">
            {elegido && <input type="hidden" name="c" value={elegido} />}
            <input name="q" defaultValue={q} placeholder="Buscar contacto…"
              className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent" />
          </form>
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {lista.items.map((c) => {
              const m = ultimo.get(c.id);
              const e = ESTADO_CONTACTO[c.estado];
              return (
                <li key={c.id}>
                  {/* <a> y no <Link>: cada chat se abre con una carga completa. Con la navegación del cliente quedaba
                      el historial del chat anterior apilado sobre el nuevo. */}
                  <a href={href(c.id)} className={`block px-3 py-2.5 hover:bg-surface-2 ${c.id === elegido ? "bg-surface-2" : ""}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{c.nombre || verTelefono(c.telefono)}</span>
                      <span className="shrink-0 text-[10px] text-muted">{fechaHora(c.ultimo_mensaje)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {m ? `${m.direccion === "out" ? "Vos: " : ""}${m.texto}` : c.empresa}
                    </p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${e?.clase ?? ""}`}>{e?.nombre ?? c.estado}</span>
                  </a>
                </li>
              );
            })}
            {lista.items.length === 0 && (
              <li className="p-6 text-center text-sm text-muted">
                {q ? "Ningún chat coincide con la búsqueda." : "Todavía no hay conversaciones. Van a aparecer acá cuando el motor de envío empiece a funcionar."}
              </li>
            )}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border border-line bg-surface">
          {!elegido ? (
            <p className="m-auto p-6 text-sm text-muted">Elegí un chat de la lista para ver la conversación.</p>
          ) : !contacto ? (
            <p className="m-auto p-6 text-sm text-muted">No encuentro ese contacto.</p>
          ) : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{contacto.nombre || "Sin nombre"}</h2>
                  <p className="truncate text-xs text-muted">
                    {[contacto.empresa, verTelefono(contacto.telefono), contacto.expand?.campana?.nombre].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className={`rounded-full px-2.5 py-0.5 font-semibold ${ESTADO_CONTACTO[contacto.estado]?.clase ?? ""}`}>
                    {ESTADO_CONTACTO[contacto.estado]?.nombre ?? contacto.estado}
                  </span>
                  <span className="flex items-center gap-2">
                    Agente <BotonAgente id={contacto.id} activo={contacto.agente_activo} />
                  </span>
                </div>
              </header>

              <HistorialScroll key={elegido}>
                {historial.length === 0 && <p className="py-10 text-center text-sm text-muted">Todavía no hay mensajes con este contacto.</p>}
                {historial.map((m, i) => {
                  const saliente = m.direccion === "out";
                  const nuevoDia = i === 0 || diaAR(historial[i - 1].created) !== diaAR(m.created);
                  return (
                    <div key={m.id}>
                      {nuevoDia && <p className="my-3 text-center text-[11px] text-muted">{etiquetaDia(m.created)}</p>}
                      <div className={`flex ${saliente ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${saliente ? "rounded-tr-none bg-[#0f3d2e]" : "rounded-tl-none bg-surface-2"}`}>
                          <p className="whitespace-pre-line break-words">{m.texto}</p>
                          {m.media && (
                            <a href={m.media} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-accent hover:underline">
                              Ver archivo adjunto
                            </a>
                          )}
                          <p className="mt-1 text-right text-[10px] text-muted">
                            {AUTOR[m.autor] ?? m.autor} · {horaAR(m.created)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </HistorialScroll>

              <CajaMensaje key={elegido} contactoId={elegido} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
