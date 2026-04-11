export default function PanelAdmin({ resumenAdmin, onLogout }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <p className="text-sm uppercase tracking-wide text-emerald-700 font-semibold">
          Sesion administradora activa
        </p>
        <p className="text-slate-900 text-lg font-bold mt-1">
          Usuario: {resumenAdmin?.usuario || 'Administrador'}
        </p>
        <p className="text-slate-600 mt-1">
          Puedes importar tu Excel, editar la planilla en la grilla y guardar cambios.
        </p>
      </div>

      <button
        onClick={onLogout}
        className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-medium hover:bg-slate-700 transition"
      >
        Cerrar sesion
      </button>
    </div>
  );
}
