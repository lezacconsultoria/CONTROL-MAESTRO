export default function AvisoSinToken() {
  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-dashed border-line p-6 text-sm">
      <p className="font-semibold">Falta conectar el Blog con GitHub</p>
      <p className="mt-2 text-muted">
        Para publicar, Control Maestro necesita un token de GitHub con permiso de escritura sobre el repositorio del sitio:
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
        <li>En GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li>
        <li>Repositorio: solo <span className="text-ink">lezacconsultoria/Lezac</span>. Permiso: <span className="text-ink">Contents → Read and write</span>.</li>
        <li>
          Pegalo en la configuración de Control Maestro como <code className="text-ink">GITHUB_TOKEN</code> (en <code>.env.local</code> en tu PC y en las
          variables del servidor donde corre) y reiniciá la aplicación.
        </li>
      </ol>
    </div>
  );
}
