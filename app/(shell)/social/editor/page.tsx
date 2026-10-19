import { PB_URL, pb, pbTodos, type List, type SocialPost, type Cuenta } from "@/lib/pb";
import { aInputLocal } from "@/lib/fecha";
import EditorForm, { type PostEditable } from "./EditorForm";

export default async function Editor({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; fecha?: string; aviso?: string }>;
}) {
  const { id, fecha, aviso } = await searchParams;
  const [cuentasRes, usados] = await Promise.all([
    pb<List<Cuenta>>("collections/social_cuentas/records?perPage=50"),
    pbTodos<{ campo: string; valor: string }>("social_historial", "", "-ultimo_uso"),
  ]);
  const cuentas = cuentasRes.items;
  const historial = {
    hashtags: usados.filter((u) => u.campo === "hashtags").map((u) => u.valor),
    pilar: usados.filter((u) => u.campo === "pilar").map((u) => u.valor),
  };
  let p: PostEditable = {
    id: "",
    cuenta: cuentas.find((c) => c.plataforma === "instagram")?.id ?? "",
    tipo: "imagen",
    caption: "",
    hashtags: "",
    pilar: "",
    portada: "",
    tapa: "",
    programado_en: fecha ? `${fecha}T10:00` : "",
    estado: "borrador",
    error: "",
    media: [],
  };
  if (id) {
    const r = await pb<SocialPost>(`collections/social_posts/records/${encodeURIComponent(id)}`);
    p = {
      id: r.id,
      cuenta: r.cuenta,
      tipo: r.tipo,
      caption: r.caption,
      hashtags: r.hashtags,
      pilar: r.pilar ?? "",
      portada: r.portada ? `${PB_URL}/api/files/social_posts/${r.id}/${r.portada}` : "",
      tapa: r.tapa ? `${PB_URL}/api/files/social_posts/${r.id}/${r.tapa}` : "",
      programado_en: aInputLocal(r.programado_en),
      estado: r.estado,
      error: r.error,
      media: (r.media ?? []).map((n) => ({
        nombre: n,
        url: `${PB_URL}/api/files/social_posts/${r.id}/${n}`,
      })),
    };
  }
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">{id ? "Editar post" : "Nuevo post"}</h1>
      <EditorForm key={p.id || "nuevo"} post={p} cuentas={cuentas} aviso={aviso} historial={historial} />
    </div>
  );
}
