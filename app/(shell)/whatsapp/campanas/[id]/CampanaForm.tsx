"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { eliminarCampana, guardarCampana } from "../actions";
import Cargando from "@/components/Cargando";
import type { WaPaso } from "@/lib/pb";
import { ESTADO_CAMPANA, MAX_FICHA, MAX_MENSAJES_PASO, MAX_PASOS, MAX_TEXTO, VARIABLES, enlacesDe, normEtiqueta, partesConEnlaces, rellenar } from "@/lib/wa";

/** Una etiqueta de Contactos: cuántos contactos la tienen y cuántos todavía no recibieron ninguna campaña. */
export type EtiquetaInfo = { nombre: string; total: number; sinContactar: number };

export type CampanaEditable = {
  id: string;
  nombre: string;
  etiqueta: string;
  estado: string;
  pasos: WaPaso[];
  espera_cierre_horas: number;
  modo_respuesta: string;
  ficha: string;
};

const PLANTILLA_FICHA = `Qué ofrecemos:


A quién va dirigido:


Objetivo de la conversación (ej: agendar una reunión de 15 minutos):


Preguntas frecuentes y cómo responderlas:
-


Enlaces que podés mandar:
-


Qué NO podés decir ni prometer (precios, plazos, descuentos, resultados):
- `;

const campo =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";
const campoHoras = "w-20 rounded-md border border-line bg-surface-2 px-2 py-1 text-sm text-ink outline-none focus:border-accent";
const boton = "rounded-md bg-surface-2 px-2.5 py-1 text-xs text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted";
const EJEMPLO = { nombre: "Juan", empresa: "Distribuidora Norte" };
const OTRA = "__otra__";

export default function CampanaForm({ campana, contactos, etiquetas }: { campana: CampanaEditable; contactos: number; etiquetas: EtiquetaInfo[] }) {
  const [res, action, pending] = useActionState(guardarCampana, { error: null });
  const [etiqueta, setEtiqueta] = useState(campana.etiqueta);
  // Si la campaña ya tiene una etiqueta que todavía no existe en Contactos, se muestra como «Otra».
  const [otra, setOtra] = useState(!!campana.etiqueta && !etiquetas.some((e) => e.nombre === normEtiqueta(campana.etiqueta)));
  const [estado, setEstado] = useState(campana.estado);
  const [modo, setModo] = useState(campana.modo_respuesta || "avisar");
  const [ficha, setFicha] = useState(campana.ficha);
  const [avisoFicha, setAvisoFicha] = useState("");

  // Carga un .md (o .txt) en el cuadro de la ficha, para revisarlo y ajustarlo antes de guardar.
  const cargarArchivo = async (archivo: File | undefined) => {
    setAvisoFicha("");
    if (!archivo) return;
    if (!/\.(md|markdown|txt)$/i.test(archivo.name)) return setAvisoFicha("El archivo tiene que ser .md, .markdown o .txt.");
    if (archivo.size > 200 * 1024) return setAvisoFicha("El archivo es demasiado grande (máximo 200 KB).");
    const texto = (await archivo.text()).replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
    if (!texto) return setAvisoFicha("El archivo está vacío.");
    if (texto.length > MAX_FICHA) {
      return setAvisoFicha(`El archivo tiene ${texto.length.toLocaleString("es-AR")} caracteres y el máximo es ${MAX_FICHA.toLocaleString("es-AR")}. Resumilo o dividilo.`);
    }
    if (ficha.trim() && !window.confirm("La ficha ya tiene texto. ¿Reemplazarlo con el contenido del archivo?")) return;
    setFicha(texto);
    setAvisoFicha(`Cargado «${archivo.name}». Revisalo y, si está bien, guardá la campaña.`);
  };
  const destino = etiquetas.find((e) => e.nombre === normEtiqueta(etiqueta));
  const [pasos, setPasos] = useState<WaPaso[]>(campana.pasos.length ? campana.pasos : [{ espera_horas: 0, mensajes: [""] }]);
  const areas = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const ultimo = useRef({ p: 0, m: 0 }); // dónde estuvo el cursor por última vez

  const cambiarTexto = (p: number, m: number, v: string) =>
    setPasos((ps) => ps.map((x, i) => (i === p ? { ...x, mensajes: x.mensajes.map((t, k) => (k === m ? v : t)) } : x)));
  const cambiarEspera = (p: number, v: number) => setPasos((ps) => ps.map((x, i) => (i === p ? { ...x, espera_horas: v } : x)));
  const agregarMensaje = (p: number) =>
    setPasos((ps) => ps.map((x, i) => (i === p && x.mensajes.length < MAX_MENSAJES_PASO ? { ...x, mensajes: [...x.mensajes, ""] } : x)));
  const quitarMensaje = (p: number, m: number) =>
    setPasos((ps) => ps.map((x, i) => (i === p && x.mensajes.length > 1 ? { ...x, mensajes: x.mensajes.filter((_, k) => k !== m) } : x)));
  const agregarPaso = () =>
    setPasos((ps) => (ps.length < MAX_PASOS ? [...ps, { espera_horas: 24, mensajes: [""] }] : ps));
  const quitarPaso = (p: number) => {
    ultimo.current = { p: 0, m: 0 };
    setPasos((ps) => (ps.length > 1 ? ps.filter((_, i) => i !== p) : ps));
  };

  const insertar = (variable: string) => {
    const { p, m } = ultimo.current;
    const actual = pasos[p]?.mensajes[m] ?? "";
    const el = areas.current[`${p}-${m}`];
    const marca = `{${variable}}`;
    if (!el) return cambiarTexto(p, m, actual + marca);
    const ini = el.selectionStart ?? actual.length;
    const fin = el.selectionEnd ?? ini;
    cambiarTexto(p, m, actual.slice(0, ini) + marca + actual.slice(fin));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };

  const hayMensajes = pasos.some((p) => p.mensajes.some((t) => t.trim()));

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
      <form action={action} className="space-y-5">
        <input type="hidden" name="id" value={campana.id} />
        <input type="hidden" name="pasos" value={JSON.stringify(pasos)} />

        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Nombre</span>
            <input name="nombre" required maxLength={120} defaultValue={campana.nombre} placeholder="Ej: Distribuidoras de Cuyo – octubre" className={campo} />
          </label>
          <div className="block text-sm">
            <label htmlFor="etiqueta-destino" className="mb-1 block text-muted">Se envía a la etiqueta</label>
            <select id="etiqueta-destino" className={campo}
              value={otra ? OTRA : normEtiqueta(etiqueta)}
              onChange={(e) => {
                if (e.target.value === OTRA) { setOtra(true); setEtiqueta(""); }
                else { setOtra(false); setEtiqueta(e.target.value); }
              }}>
              <option value="">— Ninguna (queda sin enviar) —</option>
              {etiquetas.map((e) => (
                <option key={e.nombre} value={e.nombre}>{`${e.nombre} (${e.total} ${e.total === 1 ? "contacto" : "contactos"})`}</option>
              ))}
              <option value={OTRA}>Otra etiqueta…</option>
            </select>
            {otra && (
              <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} maxLength={60} autoFocus
                placeholder="Escribí la etiqueta, ej: distribuidoras" className={`${campo} mt-2`} />
            )}
            <input type="hidden" name="etiqueta" value={normEtiqueta(etiqueta)} />
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Estado</span>
            <select name="estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={campo}>
              {Object.entries(ESTADO_CAMPANA).map(([k, e]) => (
                <option key={k} value={k}>{e.nombre}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3 text-xs">
          {!normEtiqueta(etiqueta) ? (
            <p className="text-muted">
              Elegí a qué etiqueta de <b className="text-ink">Contactos</b> se le envía. Si todavía no sabés, dejala vacía y guardala como{" "}
              <b className="text-ink">Borrador</b>: no se envía nada.
            </p>
          ) : destino ? (
            <p className="text-muted">
              <b className="text-ink">{destino.sinContactar}</b> {destino.sinContactar === 1 ? "contacto" : "contactos"} con la etiqueta «{destino.nombre}» todavía
              no {destino.sinContactar === 1 ? "recibió" : "recibieron"} ninguna campaña ({destino.total} en total).
              {estado === "activa" ? " Al guardarla activa, el envío empieza solo, dentro del horario y el tope diario." : " Con la campaña en Borrador no se envía nada."}
            </p>
          ) : (
            <p className="text-[#f5c842]">No hay contactos con la etiqueta «{normEtiqueta(etiqueta)}» todavía. Cargalos en Contactos con esa etiqueta.</p>
          )}
        </div>

        <div className="space-y-1 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-2">
            <span>Variables (se reemplazan por los datos de cada contacto):</span>
            {VARIABLES.map((v) => (
              <button key={v} type="button" onClick={() => insertar(v)}
                className="rounded-md bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink hover:text-accent">
                {`{${v}}`}
              </button>
            ))}
            <span>· se insertan donde tengas el cursor</span>
          </div>
          <p>
            Cada <b className="text-ink">paso</b> se envía solo si el contacto no respondió. Dentro de un paso podés poner varios mensajes:
            salen uno detrás del otro, con unos segundos de pausa, como si los escribieras a mano.
          </p>
        </div>

        {pasos.map((paso, p) => (
          <div key={p} className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Paso {p + 1}</span>
              {pasos.length > 1 && (
                <button type="button" onClick={() => quitarPaso(p)} className="text-xs text-muted hover:text-red-400">Quitar paso</button>
              )}
            </div>

            {p > 0 && (
              <label className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                Esperar
                <input type="number" min={0} max={1440} value={paso.espera_horas}
                  onChange={(e) => cambiarEspera(p, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className={campoHoras} />
                horas después del paso {p} para enviar este
              </label>
            )}

            <div className="space-y-3">
              {paso.mensajes.map((texto, m) => {
                const enlaces = enlacesDe(texto);
                return (
                  <div key={m}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted">
                        {paso.mensajes.length > 1 ? `Mensaje ${m + 1} de ${paso.mensajes.length} (sale como un globo aparte)` : "Mensaje"}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className={texto.length > MAX_TEXTO ? "text-red-400" : "text-muted"}>{texto.length}/{MAX_TEXTO}</span>
                        {paso.mensajes.length > 1 && (
                          <button type="button" onClick={() => quitarMensaje(p, m)} className="text-muted hover:text-red-400">Quitar</button>
                        )}
                      </span>
                    </div>
                    <textarea
                      ref={(el) => { areas.current[`${p}-${m}`] = el; }}
                      rows={p === 0 && m === 0 ? 5 : 3}
                      value={texto}
                      onFocus={() => { ultimo.current = { p, m }; }}
                      onChange={(e) => cambiarTexto(p, m, e.target.value)}
                      placeholder={p === 0 && m === 0 ? "Hola {nombre}, soy Leandro de Lezac Consultoría…" : p === 0 ? "Otro mensaje que sale enseguida…" : "Mensaje de seguimiento si no responde…"}
                      className={campo}
                    />
                    {enlaces.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {enlaces.map((e, i) => (
                          <li key={i} className={e.completo ? "text-[#25f5a4]" : "text-[#f5c842]"}>
                            {e.completo
                              ? `✓ ${e.texto} — se envía como enlace clickeable`
                              : `⚠ «${e.texto}» no empieza con https:// — puede verse como texto. Escribilo completo, por ejemplo https://${e.texto}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={() => agregarMensaje(p)} disabled={paso.mensajes.length >= MAX_MENSAJES_PASO} className={`mt-3 ${boton}`}>
              + Otro mensaje seguido en este paso
            </button>
          </div>
        ))}

        <button type="button" onClick={agregarPaso} disabled={pasos.length >= MAX_PASOS} className={boton}>
          + Agregar paso {pasos.length < MAX_PASOS ? `(${pasos.length}/${MAX_PASOS})` : `(máximo ${MAX_PASOS})`}
        </button>

        <label className="flex flex-wrap items-center gap-2 text-sm text-muted">
          Cerrar la secuencia (pasa a «sin respuesta»)
          <input type="number" name="espera_cierre_horas" min={0} max={1440} defaultValue={campana.espera_cierre_horas} className={campoHoras} />
          horas después del último paso
        </label>

        <div className="rounded-lg border border-line bg-surface p-4">
          <h2 className="font-semibold">Si responden</h2>
          <p className="mt-1 text-xs text-muted">Qué pasa cuando un contacto contesta a esta campaña. En los dos casos se frena la secuencia y te llega el aviso.</p>

          <div className="mt-3 space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="radio" name="modo_respuesta" value="avisar" checked={modo === "avisar"} onChange={() => setModo("avisar")} className="mt-1" />
              <span><b>Solo avisarme.</b> <span className="text-muted">El agente no contesta: seguís vos desde Chats o desde el celular.</span></span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="modo_respuesta" value="agente" checked={modo === "agente"} onChange={() => setModo("agente")} className="mt-1" />
              <span><b>Responde el agente y me avisa.</b> <span className="text-muted">Contesta usando la ficha de abajo. Te pasa la conversación cuando no sabe qué decir, piden precio o condiciones, quieren hablar con una persona o hay un reclamo.</span></span>
            </label>
          </div>

          {/* En «solo avisarme» la ficha no se ve, pero se conserva por si más adelante se vuelve a activar el agente. */}
          {modo !== "agente" && <input type="hidden" name="ficha" value={ficha} />}

          {modo === "agente" && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted">Ficha de la campaña: lo que el agente tiene que saber</span>
                <span className="flex items-center gap-3">
                  <label className="cursor-pointer text-accent hover:underline">
                    Cargar un archivo .md
                    <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="sr-only"
                      onChange={(e) => { void cargarArchivo(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  {!ficha.trim() && (
                    <button type="button" onClick={() => setFicha(PLANTILLA_FICHA)} className="text-accent hover:underline">Usar una plantilla</button>
                  )}
                  <span className={ficha.length > MAX_FICHA ? "text-red-400" : "text-muted"}>{ficha.length.toLocaleString("es-AR")}/{MAX_FICHA.toLocaleString("es-AR")}</span>
                </span>
              </div>
              {avisoFicha && <p className={`mb-1 text-xs ${avisoFicha.startsWith("Cargado") ? "text-[#25f5a4]" : "text-red-400"}`}>{avisoFicha}</p>}
              <textarea
                name="ficha"
                rows={12}
                maxLength={MAX_FICHA}
                value={ficha}
                onChange={(e) => setFicha(e.target.value)}
                placeholder="Contale al agente de qué trata la campaña, qué querés lograr y qué puede y no puede decir. Solo va a usar lo que escribas acá."
                className={campo}
              />
              <p className="mt-1 text-[11px] text-muted">
                El agente solo responde con lo que está en la ficha y en sus instrucciones generales. Si algo no está acá, te pasa la conversación.
                Un enlace escrito completo (https://…) sale clickeable.
              </p>
            </div>
          )}
        </div>

        {res.error && <p className="text-sm text-red-400">{res.error}</p>}
        {pending && <Cargando texto="Guardando la campaña…" />}

        <div className="flex items-center gap-3">
          <button disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar campaña"}
          </button>
          <Link href="/whatsapp/campanas" className="text-sm text-muted hover:text-ink">Cancelar</Link>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted">Así lo ve «{EJEMPLO.nombre}» ({EJEMPLO.empresa})</p>
          <div className="space-y-3">
            {pasos.map((paso, p) => {
              const textos = paso.mensajes.filter((t) => t.trim());
              if (!textos.length) return null;
              return (
                <div key={p} className="space-y-1.5">
                  <p className="text-center text-[10px] uppercase tracking-wide text-muted">
                    Paso {p + 1}{p > 0 ? ` · ${paso.espera_horas} h después, si no respondió` : ""}
                  </p>
                  {textos.map((t, m) => (
                    <div key={m} className="ml-6 rounded-lg rounded-tr-none bg-[#0f3d2e] px-3 py-2 text-sm">
                      <p className="whitespace-pre-line break-words">
                        {partesConEnlaces(rellenar(t, EJEMPLO)).map((parte, i) =>
                          parte.tipo === "texto" ? (
                            <span key={i}>{parte.texto}</span>
                          ) : (
                            <span key={i} className={parte.tipo === "enlace" ? "break-all text-sky-400 underline" : "break-all text-[#f5c842]"}>
                              {parte.texto}
                            </span>
                          ),
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
            {!hayMensajes && <p className="text-xs text-muted">Escribí un mensaje para ver la vista previa.</p>}
          </div>
          <p className="mt-3 border-t border-line pt-2 text-[11px] leading-snug text-muted">
            Los enlaces que empiezan con <span className="text-sky-400">https://</span> salen clickeables, y WhatsApp les arma la tarjeta con
            imagen y título si la página los ofrece. Los que no empiezan así se marcan en <span className="text-[#f5c842]">amarillo</span>:
            pueden verse como texto.
          </p>
        </div>

        {campana.id && (
          <form action={eliminarCampana} className="rounded-lg border border-line p-3 text-sm">
            <input type="hidden" name="id" value={campana.id} />
            {contactos > 0 ? (
              <p className="text-xs text-muted">Tiene {contactos} contactos asignados, por eso no se puede eliminar. Podés terminarla.</p>
            ) : (
              <button className="text-red-400 hover:underline">Eliminar campaña</button>
            )}
          </form>
        )}
      </aside>
    </div>
  );
}
