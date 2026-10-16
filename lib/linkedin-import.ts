import * as XLSX from "xlsx";

// Lee las exportaciones de analíticas de LinkedIn (perfil personal .xlsx y página de empresa .xls).

export type Dia = {
  fecha: string;
  impresiones?: number;
  impresiones_unicas?: number;
  interacciones?: number;
  clics?: number;
  reacciones?: number;
  comentarios?: number;
  compartidos?: number;
  seguidores_nuevos?: number;
  tasa_interaccion?: number;
};

export type PostLi = {
  url: string;
  fecha?: string;
  titulo?: string;
  tipo_contenido?: string;
  impresiones?: number;
  visualizaciones?: number;
  clics?: number;
  reacciones?: number;
  comentarios?: number;
  compartidos?: number;
  interacciones?: number;
  tasa_interaccion?: number;
};

export type Audiencia = { origen: "publico" | "contenido"; categoria: string; valor: string; pct: number; pct_texto: string };

export type Resumen = { desde?: string; hasta?: string; impresiones?: number; alcanzados?: number; seguidores_total?: number };

export type Analitica = { tipo: "perfil" | "pagina"; dias: Dia[]; posts: PostLi[]; audiencia: Audiencia[]; resumen: Resumen };

type Fila = unknown[];

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

const numero = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    if (v.trim() !== "" && Number.isFinite(n)) return n;
  }
  return undefined;
};

const iso = (y: number, m: number, d: number) => {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 2000)) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} 00:00:00.000Z`;
};

// orden "dmy" para el perfil (es-AR) y "mdy" para la página (en-US).
function fecha(v: unknown, orden: "dmy" | "mdy"): string | undefined {
  if (typeof v === "number" && v > 30000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const m = String(v ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return orden === "dmy" ? iso(y, b, a) : iso(y, a, b);
}

// "< 1 %", "4 %", "1,5 %"
function porcentaje(v: unknown): { pct: number; texto: string } {
  const texto = String(v ?? "").replace(/\s+/g, " ").trim();
  const n = numero(texto.replace(/[^\d.,]/g, ""));
  return { pct: texto.startsWith("<") ? (n ?? 1) / 2 : (n ?? 0), texto };
}

function filas(wb: XLSX.WorkBook, hoja: string): Fila[] {
  return XLSX.utils.sheet_to_json<Fila>(wb.Sheets[hoja], { header: 1, defval: null, raw: true });
}

const buscarHoja = (wb: XLSX.WorkBook, prefijo: string) => wb.SheetNames.find((n) => norm(n).startsWith(prefijo));

export function leerAnalitica(datos: ArrayBuffer): Analitica {
  const wb = XLSX.read(datos, { type: "array" });
  if (buscarHoja(wb, "DESCUBRIMIENTO")) return leerPerfil(wb);
  if (buscarHoja(wb, "INDICADORES") && buscarHoja(wb, "TODAS LAS PUBLICACIONES")) return leerPagina(wb);
  throw new Error("No reconozco este archivo. Subí la exportación de analíticas de LinkedIn (perfil .xlsx o página .xls).");
}

function leerPerfil(wb: XLSX.WorkBook): Analitica {
  const dias = new Map<string, Dia>();
  const dia = (f: string) => {
    const k = f.slice(0, 10);
    if (!dias.has(k)) dias.set(k, { fecha: f });
    return dias.get(k)!;
  };
  const resumen: Resumen = {};

  const desc = buscarHoja(wb, "DESCUBRIMIENTO");
  if (desc) {
    for (const f of filas(wb, desc)) {
      const k = norm(f[0]);
      if (k === "RENDIMIENTO GENERAL") {
        const [d, h] = String(f[1] ?? "").split("-").map((s) => fecha(s.trim(), "dmy"));
        resumen.desde = d;
        resumen.hasta = h;
      } else if (k === "IMPRESIONES") resumen.impresiones = numero(f[1]);
      else if (k.startsWith("MIEMBROS ALCANZADOS")) resumen.alcanzados = numero(f[1]);
    }
  }

  const inter = buscarHoja(wb, "INTERACCI");
  if (inter) {
    for (const f of filas(wb, inter)) {
      const fe = fecha(f[0], "dmy");
      if (!fe) continue;
      Object.assign(dia(fe), { impresiones: numero(f[1]), interacciones: numero(f[2]) });
    }
  }

  const seg = buscarHoja(wb, "SEGUIDORES");
  if (seg) {
    const fs = filas(wb, seg);
    if (norm(fs[0]?.[0]).startsWith("TOTAL DE SEGUIDORES")) resumen.seguidores_total = numero(fs[0][1]);
    for (const f of fs) {
      const fe = fecha(f[0], "dmy");
      if (fe) dia(fe).seguidores_nuevos = numero(f[1]);
    }
  }

  const posts = new Map<string, PostLi>();
  const top = buscarHoja(wb, "PUBLICACIONES PRINCIPALES");
  if (top) {
    const fs = filas(wb, top);
    const cab = fs.findIndex((f) => norm(f[0]).startsWith("URL DE LA PUBLICACION"));
    for (const f of cab >= 0 ? fs.slice(cab + 1) : []) {
      if (f[0]) {
        const p = posts.get(String(f[0])) ?? { url: String(f[0]) };
        posts.set(p.url, { ...p, fecha: fecha(f[1], "dmy") ?? p.fecha, interacciones: numero(f[2]) });
      }
      if (f[4]) {
        const p = posts.get(String(f[4])) ?? { url: String(f[4]) };
        posts.set(p.url, { ...p, fecha: fecha(f[5], "dmy") ?? p.fecha, impresiones: numero(f[6]) });
      }
    }
  }

  const audiencia: Audiencia[] = [];
  for (const [prefijo, origen] of [["INFORMACION DETALLADA DEL PUBLI", "publico"], ["INFORMACION DETALLADA DEL CONTE", "contenido"]] as const) {
    const h = buscarHoja(wb, prefijo);
    if (!h) continue;
    for (const f of filas(wb, h).slice(1)) {
      if (!f[0] || !f[1]) continue;
      const { pct, texto } = porcentaje(f[2]);
      audiencia.push({ origen, categoria: String(f[0]).trim(), valor: String(f[1]).trim(), pct, pct_texto: texto });
    }
  }

  return { tipo: "perfil", dias: [...dias.values()], posts: [...posts.values()], audiencia, resumen };
}

function leerPagina(wb: XLSX.WorkBook): Analitica {
  const resumen: Resumen = {};
  const dias: Dia[] = [];

  const ind = filas(wb, buscarHoja(wb, "INDICADORES")!);
  const cab = ind.findIndex((f) => norm(f[0]) === "FECHA");
  if (cab >= 0) {
    const col = (nombre: string) => ind[cab].findIndex((c) => norm(c) === nombre);
    const c = {
      impresiones: col("IMPRESIONES (TOTALES)"),
      unicas: col("IMPRESIONES UNICAS (ORGANICAS)"),
      clics: col("CLICS (TOTALES)"),
      reacciones: col("REACCIONES (TOTAL)"),
      comentarios: col("COMENTARIOS (TOTALES)"),
      compartidos: col("VECES COMPARTIDO (TOTAL)"),
      tasa: col("TASA DE INTERACCION (TOTAL)"),
    };
    for (const f of ind.slice(cab + 1)) {
      const fe = fecha(f[0], "mdy");
      if (!fe) continue;
      const v = (i: number) => (i >= 0 ? numero(f[i]) ?? 0 : 0);
      dias.push({
        fecha: fe,
        impresiones: v(c.impresiones),
        impresiones_unicas: v(c.unicas),
        clics: v(c.clics),
        reacciones: v(c.reacciones),
        comentarios: v(c.comentarios),
        compartidos: v(c.compartidos),
        interacciones: v(c.clics) + v(c.reacciones) + v(c.comentarios) + v(c.compartidos),
        tasa_interaccion: v(c.tasa),
      });
    }
  }
  if (dias.length) {
    const orden = dias.map((d) => d.fecha).sort();
    resumen.desde = orden[0];
    resumen.hasta = orden.at(-1);
    resumen.impresiones = dias.reduce((s, d) => s + (d.impresiones ?? 0), 0);
  }

  const posts: PostLi[] = [];
  const pub = filas(wb, buscarHoja(wb, "TODAS LAS PUBLICACIONES")!);
  const cp = pub.findIndex((f) => f.some((c) => norm(c) === "ENLACE DE LA PUBLICACION"));
  if (cp >= 0) {
    const col = (nombre: string) => pub[cp].findIndex((c) => norm(c) === nombre);
    const c = {
      titulo: col("TITULO DE LA PUBLICACION"),
      url: col("ENLACE DE LA PUBLICACION"),
      fecha: col("FECHA DE CREACION"),
      impresiones: col("IMPRESIONES"),
      vis: col("VISUALIZACIONES"),
      clics: col("CLICS"),
      reacciones: col("RECOMENDACIONES"),
      comentarios: col("COMENTARIOS"),
      compartidos: col("VECES COMPARTIDO"),
      tasa: col("TASA DE INTERACCION"),
      tipo: col("TIPO DE CONTENIDO"),
    };
    for (const f of pub.slice(cp + 1)) {
      const url = String(f[c.url] ?? "").trim();
      if (!url) continue;
      const v = (i: number) => (i >= 0 ? numero(f[i]) ?? 0 : 0);
      posts.push({
        url,
        fecha: fecha(f[c.fecha], "mdy"),
        titulo: [...String(f[c.titulo] ?? "").trim()].slice(0, 300).join(""), // por caracteres, no corta emojis
        tipo_contenido: String(f[c.tipo] ?? "").trim(),
        impresiones: v(c.impresiones),
        visualizaciones: v(c.vis),
        clics: v(c.clics),
        reacciones: v(c.reacciones),
        comentarios: v(c.comentarios),
        compartidos: v(c.compartidos),
        interacciones: v(c.clics) + v(c.reacciones) + v(c.comentarios) + v(c.compartidos),
        tasa_interaccion: v(c.tasa),
      });
    }
  }

  return { tipo: "pagina", dias, posts, audiencia: [], resumen };
}
