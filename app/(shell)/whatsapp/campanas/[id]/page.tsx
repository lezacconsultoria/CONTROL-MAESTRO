import { notFound } from "next/navigation";
import { pb, pbTodos, type List, type WaCampana } from "@/lib/pb";
import { etiquetasDe, etiquetasWa as etiquetasDeCampo, pasosDe } from "@/lib/wa";
import CampanaForm, { type CampanaEditable, type EtiquetaInfo } from "./CampanaForm";

const NUEVA: CampanaEditable = {
  id: "",
  nombre: "",
  etiqueta: "",
  linea: "",
  estado: "borrador",
  pasos: [{ espera_horas: 0, mensajes: [""] }],
  espera_cierre_horas: 72,
  modo_respuesta: "avisar",
  ficha: "",
};

export default async function CampanaPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let campana = NUEVA;
  let contactos = 0;

  if (id !== "nueva") {
    if (!/^[a-z0-9]{15}$/.test(id)) notFound();
    const [c, usados] = await Promise.all([
      pb<WaCampana>(`collections/wa_campanas/records/${id}`).catch(() => null),
      pb<List<{ id: string }>>(`collections/wa_contactos/records?perPage=1&filter=${encodeURIComponent(`campana="${id}"`)}`),
    ]);
    if (!c) notFound();
    const pasos = pasosDe(c);
    campana = {
      id: c.id,
      nombre: c.nombre,
      etiqueta: c.etiqueta,
      linea: c.linea ?? "",
      estado: c.estado,
      pasos: pasos.length ? pasos : NUEVA.pasos,
      espera_cierre_horas: c.espera_cierre_horas,
      modo_respuesta: c.modo_respuesta || "avisar",
      ficha: c.ficha ?? "",
    };
    contactos = usados.totalItems;
  }

  // Etiquetas que existen en Contactos: cuántos contactos hay con cada una y cuántos todavía no se contactaron
  // (los que esta campaña, si está activa, va a encontrar).
  const catalogos = await pb<List<{ linea: string; catalogo: string }>>("collections/wa_etiquetas/records?perPage=20&fields=linea,catalogo");
  const latidos = await pb<List<{ linea: string }>>("collections/wa_latido/records?perPage=20&sort=linea&fields=linea");
  const filas = await pbTodos<{ linea: string; etiqueta: string; etiquetas_wa: string; estado: string; campana: string }>(
    "wa_contactos", 'etiqueta!="" || etiquetas_wa!=""', "", "linea,etiqueta,etiquetas_wa,estado,campana",
  );
  const lineas = latidos.items.map((l) => l.linea);

  // Etiquetas por número: al elegir «Enviar desde» solo se ofrecen las de ese número. La clave "" es «cualquiera» (todas juntas).
  // Un contacto sin número asignado (cargado por Excel) cuenta en todos.
  const armar = (linea: string): EtiquetaInfo[] => {
    const porEtiqueta = new Map<string, EtiquetaInfo>();
    for (const f of filas) {
      if (linea && f.linea && f.linea !== linea) continue;
      // Un contacto con varias etiquetas cuenta en cada una.
      for (const nombre of etiquetasDe(f)) {
        const x = porEtiqueta.get(nombre) ?? { nombre, total: 0, sinContactar: 0 };
        x.total++;
        if ((f.estado === "nuevo" || f.estado === "entrante") && (!f.campana || f.campana === campana.id)) x.sinContactar++;
        porEtiqueta.set(nombre, x);
      }
    }
    // Etiquetas creadas en WhatsApp Business que todavía no tienen ningún contacto.
    for (const c of catalogos.items) {
      if (linea && c.linea !== linea) continue;
      for (const nombre of etiquetasDeCampo({ etiquetas_wa: c.catalogo })) {
        if (!porEtiqueta.has(nombre)) porEtiqueta.set(nombre, { nombre, total: 0, sinContactar: 0 });
      }
    }
    return [...porEtiqueta.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  };
  const etiquetasPorLinea: Record<string, EtiquetaInfo[]> = { "": armar("") };
  for (const l of lineas) etiquetasPorLinea[l] = armar(l);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">{campana.id ? "Editar campaña" : "Nueva campaña"}</h1>
      <CampanaForm key={campana.id || "nueva"} campana={campana} contactos={contactos} etiquetasPorLinea={etiquetasPorLinea} lineas={lineas} />
    </div>
  );
}
