"use client";

import { useEffect, useRef, useState } from "react";

export type Punto = { fecha: string; valor: number };

const num = new Intl.NumberFormat("es-AR");
const corto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });

export default function LineaMetrica({ datos, etiqueta }: { datos: Punto[]; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAncho(el.clientWidth));
    ro.observe(el);
    setAncho(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (datos.length < 2) return <p className="text-sm text-muted">Todavía no hay suficientes datos.</p>;

  const alto = 240, izq = 48, der = 16, arr = 16, aba = 28;
  const min = Math.min(...datos.map((d) => d.valor));
  const max = Math.max(...datos.map((d) => d.valor));
  const margen = (max - min || max || 1) * 0.15;
  const lo = Math.max(0, min - margen);
  const hi = max + margen;
  const x = (i: number) => izq + (i * (ancho - izq - der)) / (datos.length - 1);
  const y = (v: number) => alto - aba - ((v - lo) / (hi - lo)) * (alto - aba - arr);
  const linea = datos.map((d, i) => `${x(i)},${y(d.valor)}`).join(" ");
  const area = `${izq},${alto - aba} ${linea} ${x(datos.length - 1)},${alto - aba}`;
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  const etiquetasX = [0, Math.floor((datos.length - 1) / 2), datos.length - 1];

  const mover = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - izq) / (ancho - izq - der)) * (datos.length - 1));
    setHover(Math.min(datos.length - 1, Math.max(0, i)));
  };

  const h = hover !== null ? datos[hover] : null;

  return (
    <div ref={caja} className="relative w-full">
      <svg width={ancho} height={alto} onMouseMove={mover} onMouseLeave={() => setHover(null)} role="img" aria-label={etiqueta}>
        <defs>
          <linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={izq} x2={ancho - der} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={izq - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {corto.format(Math.round(t))}
            </text>
          </g>
        ))}
        {etiquetasX.map((i, k) => (
          <text key={i} x={x(i)} y={alto - 8} fontSize="11" fill="var(--muted)"
            textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}>
            {dia(datos[i].fecha)}
          </text>
        ))}
        <polygon points={area} fill="url(#relleno)" />
        <polyline points={linea} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {hover !== null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={arr} y2={alto - aba} stroke="var(--muted)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.valor)} r="5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
          </g>
        )}
        {hover === null && (
          <circle cx={x(datos.length - 1)} cy={y(datos[datos.length - 1].valor)} r="4" fill="var(--accent)" />
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) - 55, 0), ancho - 130) }}
        >
          <div className="text-muted">{dia(h.fecha)}</div>
          <div className="font-semibold">{num.format(h.valor)}</div>
        </div>
      )}
    </div>
  );
}
