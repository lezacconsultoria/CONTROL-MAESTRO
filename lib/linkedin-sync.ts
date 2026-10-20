import type { Analitica } from "./linkedin-import";

// Guarda una exportación en PocketBase sin duplicar: los días se identifican por fecha,
// los posts por enlace, y lo que ya estaba igual no se vuelve a escribir.

export type Api = {
  listar: (coleccion: string, filtro: string) => Promise<Record<string, unknown>[]>;
  crear: (coleccion: string, datos: Record<string, unknown>) => Promise<unknown>;
  actualizar: (coleccion: string, id: string, datos: Record<string, unknown>) => Promise<unknown>;
  borrar: (coleccion: string, id: string) => Promise<unknown>;
};

export type Resultado = {
  dias: { nuevos: number; actualizados: number };
  posts: { nuevos: number; actualizados: number };
  audiencia: number;
};

export async function enParalelo<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

const limpio = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

async function upsert(
  api: Api,
  coleccion: string,
  cuenta: string,
  filas: Record<string, unknown>[],
  clave: (r: Record<string, unknown>) => string,
) {
  const existentes = new Map((await api.listar(coleccion, `cuenta="${cuenta}"`)).map((r) => [clave(r), r]));
  const r = { nuevos: 0, actualizados: 0 };
  await enParalelo(filas, 8, async (fila) => {
    const datos = limpio(fila);
    const previo = existentes.get(clave(fila));
    if (!previo) {
      await api.crear(coleccion, { cuenta, ...datos });
      r.nuevos++;
      return;
    }
    const cambios = Object.fromEntries(Object.entries(datos).filter(([k, v]) => k !== "fecha" && previo[k] !== v));
    if (Object.keys(cambios).length) {
      await api.actualizar(coleccion, String(previo.id), cambios);
      r.actualizados++;
    }
  });
  return r;
}

export async function guardarAnalitica(a: Analitica, cuenta: string, api: Api): Promise<Resultado> {
  const dia = (r: Record<string, unknown>) => String(r.fecha).slice(0, 10);
  const dias = await upsert(api, "social_li_diario", cuenta, a.dias, dia);
  const posts = await upsert(api, "social_li_posts", cuenta, a.posts, (r) => String(r.url));

  // La audiencia es una foto del momento: se reemplaza lo que llegó en el archivo.
  const origenes = [...new Set(a.audiencia.map((x) => x.origen))];
  for (const origen of origenes) {
    for (const r of await api.listar("social_li_audiencia", `cuenta="${cuenta}" && origen="${origen}"`)) {
      await api.borrar("social_li_audiencia", String(r.id));
    }
  }
  await enParalelo(a.audiencia, 8, (x) => api.crear("social_li_audiencia", { cuenta, ...x }));

  const actual = (await api.listar("social_li_resumen", `cuenta="${cuenta}"`))[0];
  const resumen = limpio({ ...a.resumen, actualizado: new Date().toISOString().replace("T", " ") });
  if (actual) await api.actualizar("social_li_resumen", String(actual.id), resumen);
  else await api.crear("social_li_resumen", { cuenta, ...resumen });

  return { dias, posts, audiencia: a.audiencia.length };
}
