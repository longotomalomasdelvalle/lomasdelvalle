export default function EstadoCarga({ cargando, error, sinResultados }) {
  if (cargando) {
    return (
      <div className="bg-slate-50 rounded-3xl p-6 md:p-10 text-center text-sm md:text-base text-slate-500">
        Cargando planilla...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-3xl p-6 md:p-10 text-center text-sm md:text-base text-red-700">
        {error}
      </div>
    );
  }

  if (sinResultados) {
    return (
      <div className="bg-slate-50 rounded-3xl p-6 md:p-10 text-center text-sm md:text-base text-slate-500">
        No se encontraron vecinos con esos filtros.
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-3xl p-6 md:p-10 text-center text-sm md:text-base text-slate-500">
      Ingresa una parcela, sitio o nombre completo para buscar un vecino.
    </div>
  );
}
