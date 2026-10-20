import { cambiarAgente } from "./contactos/actions";

// Interruptor del agente de un contacto: se envía solo, sin JavaScript en el navegador.
export default function BotonAgente({ id, activo }: { id: string; activo: boolean }) {
  return (
    <form action={cambiarAgente}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={activo ? "0" : "1"} />
      <button
        role="switch"
        aria-checked={activo}
        aria-label={activo ? "Desactivar agente" : "Activar agente"}
        title={activo ? "Agente activo: hacé clic para desactivarlo" : "Agente apagado: hacé clic para activarlo"}
        className={`relative h-5 w-9 rounded-full transition ${activo ? "bg-accent" : "bg-surface-2"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${activo ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </form>
  );
}
