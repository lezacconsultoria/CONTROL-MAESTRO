import Link from "next/link";
import { pb, pbTodos, type List, type WaCampana, type WaContacto } from "@/lib/pb";
import { ESTADO_CONTACTO, escapar, etiquetasDe, etiquetasWa, fechaHora, normEtiqueta, pasosDe, verTelefono } from "@/lib/wa";
import BotonAgente from "../BotonAgente";
import AccionesMasivas, { SeleccionarTodos } from "./AccionesMasivas";
import EtiquetaCelda from "./EtiquetaCelda";
import ImportarContactos from "./ImportarContactos";
import { marcarNoContactar, reactivarContacto } from "./actions";

const POR_PAGINA = 50;
const fmt = new Intl.NumberFormat("es-AR");
const campo = "rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export default async function Contactos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etiqueta?: string; estado?: string; campana?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const pagina = Math.max(1, Number(sp.p) || 1);

  const filtros: string[] = [];
  if (q) filtros.push(`(nombre~"${escapar(q)}" || empresa~"${escapar(q)}" || telefono~"${escapar(q.replace(/\D/g, "") || q)}")`);
  if (sp.etiqueta) filtros.push(`(etiqueta="${escapar(sp.etiqueta)}" || etiquetas_wa~"|${escapar(sp.etiqueta)}|")`);
  if (sp.estado && sp.estado in ESTADO_CONTACTO) filtros.push(`estado="${sp.estado}"`);
  if (sp.campana && /^[a-z0-9]{15}$/.test(sp.campana)) filtros.push(`campana="${sp.campana}"`);

  const [lista, resumen, campanas] = await Promise.all([
    pb<List<WaContacto> & { totalPages: number }>(
      `collections/wa_contactos/records?perPage=${POR_PAGINA}&page=${pagina}&sort=-created&expand=campana${
        filtros.length ? `&filter=${encodeURIComponent(filtros.join(" && "))}` : ""
      }`,
    ),
    pbTodos<{ estado: string; etiqueta: string; etiquetas_wa: string }>("wa_contactos", "", "", "estado,etiqueta,etiquetas_wa"),
    pbTodos<WaCampana>("wa_campanas", "", "nombre", "id,nombre"),
  ]);

  const porEstado = resumen.reduce<Record<string, number>>((a, c) => ((a[c.estado] = (a[c.estado] ?? 0) + 1), a), {});
  const etiquetas = [...new Set(resumen.flatMap(etiquetasDe))].sort();

  const enlace = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, etiqueta: sp.etiqueta, estado: sp.estado, campana: sp.campana, ...cambios })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };
  const hayFiltros = filtros.length > 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Contactos</h1>
      <p className="mt-1 text-sm text-muted">
        {fmt.format(resumen.length)} contactos
        {hayFiltros && ` · ${fmt.format(lista.totalItems)} con los filtros actuales`}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {Object.entries(ESTADO_CONTACTO).map(([k, e]) => (
          <Link key={k} href={enlace({ estado: sp.estado === k ? "" : k, p: "" })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${e.clase} ${sp.estado === k ? "ring-2 ring-accent" : ""}`}>
            {e.nombre} · {fmt.format(porEstado[k] ?? 0)}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        <ImportarContactos etiquetas={etiquetas} />
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar nombre, empresa o teléfono" className={`${campo} w-72`} />
        <select name="etiqueta" defaultValue={sp.etiqueta ?? ""} className={campo}>
          <option value="">Todas las etiquetas</option>
          {etiquetas.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select name="estado" defaultValue={sp.estado ?? ""} className={campo}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CONTACTO).map(([k, e]) => <option key={k} value={k}>{e.nombre}</option>)}
        </select>
        <select name="campana" defaultValue={sp.campana ?? ""} className={campo}>
          <option value="">Todas las campañas</option>
          {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button className="rounded-md bg-surface-2 px-4 py-2 text-sm font-semibold hover:text-accent">Filtrar</button>
        {hayFiltros && <Link href="?" className="text-sm text-muted hover:text-ink">Limpiar</Link>}
      </form>

      <AccionesMasivas etiquetas={etiquetas} />

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-8 px-3 py-2"><SeleccionarTodos /></th>
              <th className="px-3 py-2">Contacto</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Alta</th>
              <th className="px-3 py-2">Etiqueta</th>
              <th className="px-3 py-2">Campaña</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Paso</th>
              <th className="px-3 py-2">Próximo envío</th>
              <th className="px-3 py-2">Agente</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lista.items.map((c) => {
              const e = ESTADO_CONTACTO[c.estado] ?? { nombre: c.estado, clase: "bg-surface-2" };
              return (
                <tr key={c.id} className="bg-bg">
                  <td className="px-3 py-2">
                    <input type="checkbox" name="ids" value={c.id} form="masivo" aria-label={`Marcar a ${c.nombre || c.telefono}`} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/whatsapp/chats?c=${c.id}`} className="font-semibold hover:text-accent">{c.nombre || "Sin nombre"}</Link>
                    <div className="text-xs text-muted">{c.empresa}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{verTelefono(c.telefono)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{fechaHora(c.created) || "—"}</td>
                  <td className="px-3 py-2">
                    <EtiquetaCelda id={c.id} actual={normEtiqueta(c.etiqueta)} etiquetas={etiquetas} />
                    {etiquetasWa(c).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {etiquetasWa(c).map((e) => (
                          <span key={e} title="Etiqueta de WhatsApp: se cambia desde WhatsApp Business"
                            className="rounded-full bg-[#25f5a4]/15 px-2 py-0.5 text-[10px] font-semibold text-[#25f5a4]">
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{c.expand?.campana?.nombre ?? "—"}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.clase}`}>{e.nombre}</span></td>
                  <td className="px-3 py-2 text-xs">{c.expand?.campana ? `${c.paso}/${pasosDe(c.expand.campana).length}` : c.paso || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{fechaHora(c.proximo_envio) || "—"}</td>
                  <td className="px-3 py-2"><BotonAgente id={c.id} activo={c.agente_activo} /></td>
                  <td className="px-3 py-2 text-right">
                    {c.estado === "no_contactar" ? (
                      <form action={reactivarContacto}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-xs text-muted hover:text-accent">Reactivar</button>
                      </form>
                    ) : (
                      <form action={marcarNoContactar}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-xs text-muted hover:text-red-400">No contactar</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {lista.items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted">
                  {hayFiltros ? "Ningún contacto coincide con los filtros." : "Todavía no hay contactos. Importá un Excel para empezar."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {lista.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {pagina > 1 ? <Link href={enlace({ p: String(pagina - 1) })} className="rounded bg-surface-2 px-3 py-1.5">←</Link> : <span className="px-3 py-1.5 opacity-30">←</span>}
          <span className="text-muted">Página {pagina} de {lista.totalPages}</span>
          {pagina < lista.totalPages ? <Link href={enlace({ p: String(pagina + 1) })} className="rounded bg-surface-2 px-3 py-1.5">→</Link> : <span className="px-3 py-1.5 opacity-30">→</span>}
        </div>
      )}
    </div>
  );
}
