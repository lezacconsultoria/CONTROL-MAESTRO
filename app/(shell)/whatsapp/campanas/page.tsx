import Link from "next/link";
import { pbTodos, type WaCampana } from "@/lib/pb";
import { ESTADO_CAMPANA, normEtiqueta, pasosDe } from "@/lib/wa";
import { cambiarEstadoCampana } from "./actions";

const fmt = new Intl.NumberFormat("es-AR");

function BotonEstado({ id, estado, texto, peligro }: { id: string; estado: string; texto: string; peligro?: boolean }) {
  return (
    <form action={cambiarEstadoCampana}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button className={`rounded-md bg-surface-2 px-3 py-1.5 text-xs font-semibold ${peligro ? "hover:text-red-400" : "hover:text-accent"}`}>
        {texto}
      </button>
    </form>
  );
}

export default async function Campanas() {
  const [campanas, contactos] = await Promise.all([
    pbTodos<WaCampana>("wa_campanas", "", "-created"),
    pbTodos<{ campana: string; estado: string; etiqueta: string }>("wa_contactos", "", "", "campana,estado,etiqueta"),
  ]);
  // Contactos que todavía no recibieron ninguna campaña, por etiqueta: a esos les va a llegar la campaña con esa etiqueta.
  const sinContactar = new Map<string, number>();
  for (const c of contactos) {
    if (c.estado === "nuevo" && !c.campana && c.etiqueta) sinContactar.set(normEtiqueta(c.etiqueta), (sinContactar.get(normEtiqueta(c.etiqueta)) ?? 0) + 1);
  }
  const porCampana = new Map<string, { total: number; enSecuencia: number; respondieron: number }>();
  for (const c of contactos) {
    if (!c.campana) continue;
    const x = porCampana.get(c.campana) ?? { total: 0, enSecuencia: 0, respondieron: 0 };
    x.total++;
    if (c.estado === "en_secuencia") x.enSecuencia++;
    if (c.estado === "respondio") x.respondieron++;
    porCampana.set(c.campana, x);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Campañas</h1>
          <p className="mt-1 text-sm text-muted">Cada campaña es una secuencia de pasos; cada paso puede tener varios mensajes seguidos.</p>
        </div>
        <Link href="/whatsapp/campanas/nueva" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
          + Nueva campaña
        </Link>
      </div>

      {campanas.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line p-10 text-center text-sm text-muted">
          Todavía no hay campañas. Creá la primera con el botón de arriba.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {campanas.map((c) => {
            const e = ESTADO_CAMPANA[c.estado] ?? { nombre: c.estado, clase: "bg-surface-2" };
            const n = porCampana.get(c.id) ?? { total: 0, enSecuencia: 0, respondieron: 0 };
            const pasos = pasosDe(c);
            const globos = pasos.reduce((suma, p) => suma + p.mensajes.length, 0);
            return (
              <article key={c.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{c.nombre}</h2>
                    <p className="text-xs text-muted">
                      {c.etiqueta
                        ? `Se envía a la etiqueta «${normEtiqueta(c.etiqueta)}» · ${fmt.format(sinContactar.get(normEtiqueta(c.etiqueta)) ?? 0)} sin contactar`
                        : "Sin etiqueta: no se envía a nadie"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.clase}`}>{e.nombre}</span>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-line rounded-md bg-surface-2 p-3 text-xs">
                  {pasos[0]?.mensajes[0] || <span className="text-muted">Sin mensajes todavía.</span>}
                </p>
                <p className="mt-3 text-xs text-muted">
                  {fmt.format(n.total)} contactos · {fmt.format(n.enSecuencia)} en secuencia · {fmt.format(n.respondieron)} respondieron
                </p>
                <p className="mt-1 text-xs text-muted">
                  {pasos.length} {pasos.length === 1 ? "paso" : "pasos"} ({globos} {globos === 1 ? "mensaje" : "mensajes"})
                  {pasos.length > 1 && ` · esperas de ${pasos.slice(1).map((p) => `${p.espera_horas} h`).join(", ")}`} · cierre a las {c.espera_cierre_horas} h
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link href={`/whatsapp/campanas/${c.id}`} className="rounded-md bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:text-accent">
                    Editar
                  </Link>
                  {(c.estado === "borrador" || c.estado === "pausada") && <BotonEstado id={c.id} estado="activa" texto={c.estado === "pausada" ? "Reanudar" : "Activar"} />}
                  {c.estado === "activa" && <BotonEstado id={c.id} estado="pausada" texto="Pausar" />}
                  {c.estado !== "terminada" && <BotonEstado id={c.id} estado="terminada" texto="Terminar" peligro />}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
