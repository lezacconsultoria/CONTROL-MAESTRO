import { notFound } from "next/navigation";
import { pb, pbTodos, type List, type WaCampana } from "@/lib/pb";
import { normEtiqueta, pasosDe } from "@/lib/wa";
import CampanaForm, { type CampanaEditable, type EtiquetaInfo } from "./CampanaForm";

const NUEVA: CampanaEditable = {
  id: "",
  nombre: "",
  etiqueta: "",
  estado: "borrador",
  pasos: [{ espera_horas: 0, mensajes: [""] }],
  espera_cierre_horas: 72,
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
      estado: c.estado,
      pasos: pasos.length ? pasos : NUEVA.pasos,
      espera_cierre_horas: c.espera_cierre_horas,
    };
    contactos = usados.totalItems;
  }

  // Etiquetas que existen en Contactos: cuántos contactos hay con cada una y cuántos todavía no se contactaron
  // (los que esta campaña, si está activa, va a encontrar).
  const filas = await pbTodos<{ etiqueta: string; estado: string; campana: string }>("wa_contactos", 'etiqueta!=""', "", "etiqueta,estado,campana");
  const porEtiqueta = new Map<string, EtiquetaInfo>();
  for (const f of filas) {
    const nombre = normEtiqueta(f.etiqueta);
    const x = porEtiqueta.get(nombre) ?? { nombre, total: 0, sinContactar: 0 };
    x.total++;
    if (f.estado === "nuevo" && (!f.campana || f.campana === campana.id)) x.sinContactar++;
    porEtiqueta.set(nombre, x);
  }
  const etiquetas = [...porEtiqueta.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">{campana.id ? "Editar campaña" : "Nueva campaña"}</h1>
      <CampanaForm key={campana.id || "nueva"} campana={campana} contactos={contactos} etiquetas={etiquetas} />
    </div>
  );
}
