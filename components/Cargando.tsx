export default function Cargando({ texto, detalle }: { texto: string; detalle?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="flex w-80 flex-col items-center gap-4 rounded-xl border border-line bg-surface px-6 py-8 text-center shadow-2xl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-surface-2 border-t-accent" />
        <p className="font-display text-base font-bold">{texto}</p>
        {detalle && <p className="text-xs text-muted">{detalle}</p>}
      </div>
    </div>
  );
}
