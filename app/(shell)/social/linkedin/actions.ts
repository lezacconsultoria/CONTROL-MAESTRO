"use server";

import { revalidatePath } from "next/cache";
import { pb, type Cuenta } from "@/lib/pb";
import { apiPb as api } from "@/lib/pb-api";
import { leerAnalitica } from "@/lib/linkedin-import";
import { guardarAnalitica } from "@/lib/linkedin-sync";

export type EstadoSubida = { error: string | null; ok?: string };

const MAX_MB = 10;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export async function subirAnalitica(_: EstadoSubida, form: FormData): Promise<EstadoSubida> {
  const archivo = form.get("archivo");
  const cuentaId = String(form.get("cuenta") ?? "");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elegí el archivo que exportaste desde LinkedIn." };
  if (!/\.xlsx?$/i.test(archivo.name)) return { error: "El archivo tiene que ser un Excel (.xlsx o .xls)." };
  if (archivo.size > MAX_MB * 1048576) return { error: `El archivo pesa más de ${MAX_MB} MB.` };

  try {
    const cuenta = await pb<Cuenta>(`collections/social_cuentas/records/${encodeURIComponent(cuentaId)}`);
    if (cuenta.plataforma !== "linkedin") return { error: "Elegí una cuenta de LinkedIn." };

    const datos = leerAnalitica(await archivo.arrayBuffer());
    const esPagina = cuenta.autor_urn.startsWith("urn:li:organization");
    if (datos.tipo === "perfil" && esPagina) {
      return { error: "Ese archivo es de un perfil personal y la cuenta elegida es una página de empresa." };
    }
    if (datos.tipo === "pagina" && !esPagina) {
      return { error: "Ese archivo es de una página de empresa y la cuenta elegida es un perfil personal." };
    }

    const r = await guardarAnalitica(datos, cuenta.id, api);
    revalidatePath("/social/linkedin");
    const partes = [
      `${plural(r.dias.nuevos, "día nuevo", "días nuevos")} y ${plural(r.dias.actualizados, "actualizado", "actualizados")}`,
      `${plural(r.posts.nuevos, "post nuevo", "posts nuevos")} y ${plural(r.posts.actualizados, "actualizado", "actualizados")}`,
    ];
    if (r.audiencia) partes.push(`${r.audiencia} datos de audiencia`);
    return { error: null, ok: `Listo: ${partes.join(" · ")}.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
