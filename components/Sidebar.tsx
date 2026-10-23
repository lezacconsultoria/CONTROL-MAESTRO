"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

type Modulo = {
  href: string;
  nombre: string;
  tabs?: { href: string; nombre: string }[]; // sin tabs = módulo todavía no disponible
};

const modulos: Modulo[] = [
  {
    href: "/social",
    nombre: "Social",
    tabs: [
      { href: "/social", nombre: "Resumen" },
      { href: "/social/calendario", nombre: "Calendario" },
      { href: "/social/editor", nombre: "Nuevo post" },
      { href: "/social/analytics", nombre: "Analytics" },
      { href: "/social/linkedin", nombre: "LinkedIn" },
      { href: "/social/biblioteca", nombre: "Biblioteca" },
    ],
  },
  {
    href: "/blog",
    nombre: "Blog",
    tabs: [
      { href: "/blog", nombre: "Artículos" },
      { href: "/blog/editor", nombre: "Nuevo artículo" },
    ],
  },
  { href: "#", nombre: "CRM / Leads" },
  {
    href: "/whatsapp",
    nombre: "Bots WhatsApp",
    tabs: [
      { href: "/whatsapp", nombre: "Resumen" },
      { href: "/whatsapp/campanas", nombre: "Campañas" },
      { href: "/whatsapp/contactos", nombre: "Contactos" },
      { href: "/whatsapp/chats", nombre: "Chats" },
      { href: "/whatsapp/config", nombre: "Config" },
    ],
  },
  { href: "#", nombre: "Tablero" },
  { href: "#", nombre: "Notas" },
];

const dentroDe = (path: string, href: string) => href !== "#" && (path === href || path.startsWith(href + "/"));

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5">
      <div className="mb-6 px-3 font-display text-lg font-extrabold tracking-tight">
        Control <span className="text-accent">Maestro</span>
      </div>
      <nav className="flex flex-col gap-1">
        {modulos.map((m) => {
          if (!m.tabs) {
            return (
              <div
                key={m.nombre}
                className="flex items-center justify-between px-3 py-2 text-sm text-muted/60"
              >
                {m.nombre}
                <span className="text-[10px] uppercase tracking-wider">pronto</span>
              </div>
            );
          }
          const actual = dentroDe(path, m.href);
          return (
            <div key={m.nombre}>
              <Link
                href={m.href}
                className={`block rounded-md px-3 py-2 text-sm font-semibold ${actual ? "bg-surface-2" : "text-muted hover:text-ink"}`}
              >
                {m.nombre}
              </Link>
              {actual && (
                <div className="ml-3 mt-1 flex flex-col border-l border-line pl-3">
                  {m.tabs.map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={`rounded px-2 py-1.5 text-sm ${
                        path === t.href || (t.href !== m.href && path.startsWith(t.href + "/"))
                          ? "text-accent"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {t.nombre}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <form action={logout} className="mt-auto pt-4">
        <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-ink">
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
