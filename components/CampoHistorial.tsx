"use client";

import { useEffect, useRef, useState } from "react";

// Campo de texto con una lista desplegable de lo que ya se usó antes.
export default function CampoHistorial({
  name,
  value,
  onChange,
  opciones,
  placeholder,
  disabled,
  className,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
  placeholder?: string;
  disabled?: boolean;
  className: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [todas, setTodas] = useState(true); // true: lista completa; false: filtrada por lo que se escribe
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const q = value.trim().toLowerCase();
  const lista = todas || !q ? opciones : opciones.filter((o) => o.toLowerCase().includes(q));

  return (
    <div ref={caja} className="relative">
      <input
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className={`${className} pr-10`}
        onChange={(e) => {
          onChange(e.target.value);
          setTodas(false);
          setAbierto(true);
        }}
        onFocus={() => {
          setTodas(true);
          setAbierto(true);
        }}
        onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Ver historial"
        onClick={() => {
          setTodas(true);
          setAbierto((a) => !a);
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-40"
      >
        {abierto ? "▲" : "▼"}
      </button>

      {abierto && !disabled && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg">
          {lista.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted">
              {opciones.length === 0 ? "Todavía no hay historial: lo que escribas se guarda acá." : "Sin coincidencias en el historial."}
            </li>
          ) : (
            lista.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o);
                    setAbierto(false);
                  }}
                  className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-surface-2 ${o === value ? "text-accent" : ""}`}
                >
                  {o}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
