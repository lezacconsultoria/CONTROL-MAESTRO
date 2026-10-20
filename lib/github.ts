import "server-only";
import { cookies } from "next/headers";
import { COOKIE, PB_URL } from "./pb";
import type { Articulo, ArticuloRemoto } from "./blog";

// El Blog publica escribiendo archivos en el repo del sitio (GitHub). Una automatización del repo
// genera las páginas y Hostinger las publica solo.
const REPO = process.env.GITHUB_REPO || "lezacconsultoria/Lezac";
const RAMA = process.env.GITHUB_BRANCH || "master";
const DIR = "tools/articulos";

export const githubConfigurado = () => Boolean(process.env.GITHUB_TOKEN);

// proxy.ts solo comprueba que exista la cookie, no que sea válida. Como acá se usa un token propio del
// servidor (no el del usuario), hay que confirmar con PocketBase que la sesión es real antes de escribir o leer.
export async function exigirSesion() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw new Error("Sesión no iniciada.");
  const res = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
    method: "POST",
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Sesión inválida. Volvé a iniciar sesión.");
}

async function gh(ruta: string, init: RequestInit = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Falta GITHUB_TOKEN en la configuración de Control Maestro.");
  const res = await fetch(`https://api.github.com/repos/${REPO}/${ruta}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  return res;
}

async function ok(res: Response, que: string) {
  if (res.ok) return res;
  const detalle = (await res.text()).slice(0, 200);
  if (res.status === 401 || res.status === 403) throw new Error(`GitHub rechazó el acceso (${res.status}). Revisá el token. ${que}`);
  if (res.status === 409) throw new Error(`El artículo cambió mientras lo editabas. Recargá la página y volvé a intentar.`);
  throw new Error(`GitHub ${res.status} al ${que}: ${detalle}`);
}

const decodificar = (b64: string) => JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Articulo;
const codificar = (a: Articulo) => Buffer.from(JSON.stringify(a, null, 1) + "\n", "utf8").toString("base64");

export async function leerArticulo(slug: string): Promise<ArticuloRemoto | null> {
  const res = await gh(`contents/${DIR}/${slug}.json?ref=${RAMA}`);
  if (res.status === 404) return null;
  await ok(res, "leer el artículo");
  const j = (await res.json()) as { content: string; sha: string };
  return { articulo: decodificar(j.content), sha: j.sha };
}

export async function listarArticulos(): Promise<ArticuloRemoto[]> {
  const res = await gh(`contents/${DIR}?ref=${RAMA}`);
  if (res.status === 404) return [];
  await ok(res, "listar los artículos");
  const archivos = (await res.json()) as { name: string }[];
  const slugs = archivos.filter((f) => f.name.endsWith(".json") && !f.name.startsWith("_")).map((f) => f.name.slice(0, -5));
  const todos = await Promise.all(slugs.map((s) => leerArticulo(s)));
  return todos
    .filter((x): x is ArticuloRemoto => x !== null)
    .sort((a, b) => b.articulo.date.localeCompare(a.articulo.date));
}

export async function guardarArticuloRemoto(a: Articulo, sha: string | undefined, mensaje: string) {
  const res = await gh(`contents/${DIR}/${a.slug}.json`, {
    method: "PUT",
    body: JSON.stringify({ message: mensaje, content: codificar(a), branch: RAMA, ...(sha ? { sha } : {}) }),
  });
  await ok(res, "guardar el artículo");
}

export async function borrarArticuloRemoto(slug: string, sha: string, mensaje: string) {
  const res = await gh(`contents/${DIR}/${slug}.json`, {
    method: "DELETE",
    body: JSON.stringify({ message: mensaje, sha, branch: RAMA }),
  });
  await ok(res, "borrar el artículo");
}

export async function subirImagenRemota(nombre: string, bytes: Buffer) {
  const res = await gh(`contents/blog/img/${nombre}`, {
    method: "PUT",
    body: JSON.stringify({ message: `blog: imagen ${nombre}`, content: bytes.toString("base64"), branch: RAMA }),
  });
  await ok(res, "subir la imagen");
}
