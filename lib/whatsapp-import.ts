import * as XLSX from "xlsx";
import { enParalelo, type Api } from "./linkedin-sync";
import { normEtiqueta } from "./wa";

// Importa contactos desde un Excel/CSV: detecta las columnas por su título y deja los
// teléfonos en formato 549… (Argentina, celular), que es como los guarda wa_contactos.

export type FilaContacto = { telefono: string | null; crudo: string; nombre: string; empresa: string; etiqueta: string };

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

// Si el número trae el "15" del celular después del código de área, se lo saca.
function sin15(n: string) {
  if (n.length === 12) {
    for (const area of [2, 3, 4]) if (n.slice(area, area + 2) === "15") return n.slice(0, area) + n.slice(area + 2);
  }
  return n;
}

/** Devuelve 549 + 10 dígitos, o null si no se puede interpretar como celular argentino. */
export function normalizarTelefono(valor: unknown): string | null {
  let d = String(valor ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (!d) return null;
  if (d.startsWith("54")) {
    let r = d.slice(2);
    if (!r.startsWith("9")) r = "9" + sin15(r.replace(/^0/, ""));
    d = "54" + r;
  } else {
    d = "549" + sin15(d.replace(/^0/, ""));
  }
  return /^549\d{10}$/.test(d) ? d : null;
}

const COLUMNAS = {
  telefono: ["TELEFONO", "CELULAR", "WHATSAPP", "MOVIL", "NUMERO", "TEL", "PHONE", "CEL"],
  nombre: ["NOMBRE", "CONTACTO", "NAME", "APELLIDO Y NOMBRE"],
  empresa: ["EMPRESA", "RAZON SOCIAL", "COMPANIA", "COMPANY", "CLIENTE"],
  etiqueta: ["ETIQUETA", "TAG", "SEGMENTO", "RUBRO", "LISTA"],
};

const indice = (cab: string[], claves: string[]) => cab.findIndex((c) => claves.some((k) => c === k || c.includes(k)));

export function leerContactos(datos: ArrayBuffer): FilaContacto[] {
  const wb = XLSX.read(datos, { type: "array", raw: true });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  if (!hoja) throw new Error("El archivo no tiene hojas.");
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: "", raw: true });

  // La fila de títulos es la primera que tiene una columna de teléfono.
  const posCab = filas.findIndex((f) => indice(f.map(norm), COLUMNAS.telefono) >= 0);
  if (posCab < 0) throw new Error("No encontré una columna de teléfono. Poné un título como \"Teléfono\", \"Celular\" o \"WhatsApp\".");
  const cab = filas[posCab].map(norm);
  const col = {
    telefono: indice(cab, COLUMNAS.telefono),
    nombre: indice(cab, COLUMNAS.nombre),
    empresa: indice(cab, COLUMNAS.empresa),
    etiqueta: indice(cab, COLUMNAS.etiqueta),
  };
  const texto = (f: unknown[], i: number) => (i >= 0 ? String(f[i] ?? "").trim() : "");

  return filas
    .slice(posCab + 1)
    .filter((f) => f.some((c) => String(c ?? "").trim() !== ""))
    .map((f) => {
      const crudo = texto(f, col.telefono);
      return {
        telefono: normalizarTelefono(f[col.telefono]),
        crudo,
        nombre: texto(f, col.nombre),
        empresa: texto(f, col.empresa),
        etiqueta: texto(f, col.etiqueta),
      };
    });
}

export type ResultadoContactos = { nuevos: number; actualizados: number; repetidos: number; invalidos: string[] };

export async function guardarContactos(
  filas: FilaContacto[],
  opciones: { campana: string; etiqueta: string; origen: string },
  api: Api,
): Promise<ResultadoContactos> {
  const r: ResultadoContactos = { nuevos: 0, actualizados: 0, repetidos: 0, invalidos: [] };

  // Una sola fila por teléfono: si se repite en el archivo, se completan los datos que faltan.
  const unicos = new Map<string, FilaContacto>();
  for (const f of filas) {
    if (!f.telefono) {
      r.invalidos.push(f.crudo || "(vacío)");
      continue;
    }
    const previa = unicos.get(f.telefono);
    if (previa) {
      r.repetidos++;
      previa.nombre ||= f.nombre;
      previa.empresa ||= f.empresa;
      previa.etiqueta ||= f.etiqueta;
    } else unicos.set(f.telefono, { ...f });
  }

  const existentes = new Map((await api.listar("wa_contactos", "")).map((c) => [String(c.telefono), c]));
  await enParalelo([...unicos.values()], 6, async (f) => {
    const previo = existentes.get(f.telefono!);
    if (!previo) {
      await api.crear("wa_contactos", {
        telefono: f.telefono,
        nombre: f.nombre,
        empresa: f.empresa,
        etiqueta: normEtiqueta(f.etiqueta || opciones.etiqueta),
        origen: opciones.origen,
        campana: "", // la campaña se asigna sola cuando una campaña activa tiene la etiqueta de este contacto
        estado: "nuevo",
        paso: 0,
        agente_activo: false,
      });
      r.nuevos++;
      return;
    }
    // Un contacto que ya existe no cambia de estado, de campaña ni de etiqueta: solo se completan datos vacíos.
    const cambios: Record<string, unknown> = {};
    for (const k of ["nombre", "empresa"] as const) if (!previo[k] && f[k]) cambios[k] = f[k];
    const etiqueta = normEtiqueta(f.etiqueta || opciones.etiqueta);
    if (!previo.etiqueta && etiqueta) cambios.etiqueta = etiqueta;
    if (Object.keys(cambios).length) {
      await api.actualizar("wa_contactos", String(previo.id), cambios);
      r.actualizados++;
    }
  });
  return r;
}
