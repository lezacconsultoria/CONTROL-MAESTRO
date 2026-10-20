import Link from "next/link";
import { connection } from "next/server";
import { pb, pbTodos, type List, type WaCampana, type WaConfig, type WaContacto, type WaMensaje } from "@/lib/pb";
import { DIAS_SEMANA, ESTADO_CAMPANA, fechaHora, verTelefono } from "@/lib/wa";

const fmt = new Intl.NumberFormat("es-AR");

function Kpi({ label, value, nota, href }: { label: string; value: number | string; nota?: string; href?: string }) {
  const cuerpo = (
    <div className="h-full rounded-lg border border-line bg-surface p-4 transition hover:border-accent">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{typeof value === "number" ? fmt.format(value) : value}</div>
      {nota && <div className="mt-1 text-xs text-muted">{nota}</div>}
    </div>
  );
  return href ? <Link href={href}>{cuerpo}</Link> : cuerpo;
}

// Medianoche argentina de hoy, expresada en UTC (para filtrar "mensajes de hoy").
function medianocheAR() {
  const hoyAR = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  return `${hoyAR} 03:00:00.000Z`;
}

export default async function ResumenWhatsapp() {
  await connection(); // "hoy" cambia en cada visita
  const inicioHoy = encodeURIComponent(`created>="${medianocheAR()}"`);
  const contar = (dir: string) =>
    pb<List<WaMensaje>>(`collections/wa_mensajes/records?perPage=1&fields=id&filter=${encodeURIComponent(`direccion="${dir}" && `)}${inicioHoy}`);

  const [cfg, contactos, campanas, enviadosHoy, recibidosHoy, proximos, respuestas] = await Promise.all([
    pb<List<WaConfig>>("collections/wa_config/records?perPage=1"),
    pbTodos<{ estado: string }>("wa_contactos", "", "", "estado"),
    pbTodos<Pick<WaCampana, "id" | "nombre" | "estado">>("wa_campanas", "", "-created", "id,nombre,estado"),
    contar("out"),
    contar("in"),
    pb<List<WaContacto>>(
      `collections/wa_contactos/records?perPage=8&sort=proximo_envio&expand=campana&filter=${encodeURIComponent('estado="en_secuencia" && proximo_envio!=""')}`,
    ),
    pb<List<WaMensaje>>("collections/wa_mensajes/records?perPage=6&sort=-created&expand=contacto&filter=" + encodeURIComponent('direccion="in"')),
  ]);

  const config = cfg.items[0];
  const porEstado = contactos.reduce<Record<string, number>>((a, c) => ((a[c.estado] = (a[c.estado] ?? 0) + 1), a), {});
  const activas = campanas.filter((c) => c.estado === "activa");
  const tope = config?.tope_diario ?? 0;
  const usado = tope ? Math.min(100, (enviadosHoy.totalItems / tope) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Bots WhatsApp</h1>
          <p className="mt-1 text-sm text-muted">Campañas, contactos y conversaciones.</p>
        </div>
        {config && (
          <Link href="/whatsapp/config"
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${config.activo ? "bg-[#25f5a4]/15 text-[#25f5a4]" : "bg-surface-2 text-muted"}`}>
            {config.activo ? "● Envíos activos" : "○ Envíos apagados"}
          </Link>
        )}
      </div>

      {config && (
        <p className="mt-3 text-xs text-muted">
          Envía de {config.hora_desde} a {config.hora_hasta} h · {config.dias.map((d) => DIAS_SEMANA.find((x) => x.n === d)?.nombre).filter(Boolean).join(", ")} · hasta {config.tope_diario} mensajes por día
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Contactos" value={contactos.length} nota={`${fmt.format(porEstado.nuevo ?? 0)} sin contactar todavía`} href="/whatsapp/contactos" />
        <Kpi label="En secuencia" value={porEstado.en_secuencia ?? 0} nota="recibiendo mensajes de una campaña" href="/whatsapp/contactos?estado=en_secuencia" />
        <Kpi label="Respondieron" value={(porEstado.respondio ?? 0) + (porEstado.entrante ?? 0)} nota={`${fmt.format(porEstado.entrante ?? 0)} entrantes`} href="/whatsapp/contactos?estado=respondio" />
        <Kpi label="Campañas activas" value={activas.length} nota={`${fmt.format(campanas.length)} en total`} href="/whatsapp/campanas" />
      </div>

      <section className="mt-5 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between text-sm">
          <h2 className="font-semibold">Hoy</h2>
          <span className="text-xs text-muted">{fmt.format(recibidosHoy.totalItems)} mensajes recibidos</span>
        </div>
        <div className="mt-3 flex items-baseline justify-between text-sm">
          <span>Enviados</span>
          <span className="font-semibold">{fmt.format(enviadosHoy.totalItems)} / {fmt.format(tope)}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${usado}%` }} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Próximos envíos</h2>
          {proximos.items.length === 0 ? (
            <p className="text-sm text-muted">No hay envíos programados.</p>
          ) : (
            <ul className="divide-y divide-line">
              {proximos.items.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/whatsapp/chats?c=${c.id}`} className="truncate font-semibold hover:text-accent">{c.nombre || verTelefono(c.telefono)}</Link>
                    <p className="truncate text-xs text-muted">{c.expand?.campana?.nombre ?? "Sin campaña"} · mensaje {c.paso + 1}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{fechaHora(c.proximo_envio)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Últimas respuestas</h2>
          {respuestas.items.length === 0 ? (
            <p className="text-sm text-muted">Todavía nadie respondió.</p>
          ) : (
            <ul className="divide-y divide-line">
              {respuestas.items.map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/whatsapp/chats?c=${m.contacto}`} className="truncate font-semibold hover:text-accent">
                      {m.expand?.contacto?.nombre || (m.expand?.contacto && verTelefono(m.expand.contacto.telefono)) || "Contacto"}
                    </Link>
                    <span className="shrink-0 text-xs text-muted">{fechaHora(m.created)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{m.texto}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {campanas.length > 0 && (
        <section className="mt-6 rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Campañas</h2>
          <ul className="flex flex-wrap gap-2">
            {campanas.slice(0, 12).map((c) => (
              <li key={c.id}>
                <Link href={`/whatsapp/campanas/${c.id}`}
                  className={`block rounded-full px-3 py-1 text-xs font-semibold ${ESTADO_CAMPANA[c.estado]?.clase ?? "bg-surface-2"}`}>
                  {c.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {contactos.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
          Para empezar, <Link href="/whatsapp/contactos" className="text-accent underline">importá tus contactos</Link> y creá una{" "}
          <Link href="/whatsapp/campanas/nueva" className="text-accent underline">campaña</Link>.
        </p>
      )}
    </div>
  );
}
