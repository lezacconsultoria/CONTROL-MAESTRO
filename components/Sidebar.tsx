"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modulos = [
  { href: "/social", nombre: "Social", activo: true },
  { href: "#", nombre: "CRM / Leads", activo: false },
  { href: "#", nombre: "Bots WhatsApp", activo: false },
  { href: "#", nombre: "Tablero", activo: false },
  { href: "#", nombre: "Notas", activo: false },
];

const socialTabs = [
  { href: "/social", nombre: "Resumen" },
  { href: "/social/calendario", nombre: "Calendario" },
  { href: "/social/editor", nombre: "Nuevo post" },
  { href: "/social/analytics", nombre: "Analytics" },
  { href: "/social/biblioteca", nombre: "Biblioteca" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5">
      <div className="mb-6 px-3 font-display text-lg font-extrabold tracking-tight">
        Control <span className="text-accent">Maestro</span>
      </div>
      <nav className="flex flex-col gap-1">
        {modulos.map((m) =>
          m.activo ? (
            <div key={m.nombre}>
              <Link
                href={m.href}
                className="block rounded-md bg-surface-2 px-3 py-2 text-sm font-semibold"
              >
                {m.nombre}
              </Link>
              <div className="ml-3 mt-1 flex flex-col border-l border-line pl-3">
                {socialTabs.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`rounded px-2 py-1.5 text-sm ${
                      path === t.href ? "text-accent" : "text-muted hover:text-ink"
                    }`}
                  >
                    {t.nombre}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div
              key={m.nombre}
              className="flex items-center justify-between px-3 py-2 text-sm text-muted/60"
            >
              {m.nombre}
              <span className="text-[10px] uppercase tracking-wider">pronto</span>
            </div>
          ),
        )}
      </nav>
    </aside>
  );
}
