import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

export default function PortalPagosPasaje() {
  const [vecinos, setVecinos] = useState([]);
  const [filtroParcela, setFiltroParcela] = useState('');
  const [filtroSitio, setFiltroSitio] = useState('');
  const [filtroNombre, setFiltroNombre] = useState('');

  useEffect(() => {
    cargarExcelAutomatico();
  }, []);

  const cargarExcelAutomatico = async () => {
    try {
      const response = await fetch('/PLANILLA%20GASTOS%20COMUNES.xlsx');

      if (!response.ok) {
        throw new Error('No se encontró la planilla automática');
      }

      const data = await response.arrayBuffer();

      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        console.error('La planilla no tiene hojas');
        return;
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        console.error('No se pudo leer la hoja del Excel');
        return;
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      procesarDatosExcel(jsonData);
      } catch (error) {
      console.error('Error cargando planilla automática', error);
    }
  };

  const procesarDatosExcel = (jsonData) => {
      const vecinosExcel = jsonData.map((fila, index) => {
        const codigo = String(
          fila['PARC/ST'] || fila['SITIO'] || fila['PARCELA'] || ''
        )
          .trim()
          .toUpperCase();

        let parcela = '-';
        let sitio = '-';

        const partes = codigo.match(/(\d+)?ST(\d+)/);

        if (partes) {
          parcela = partes[1] || '-';
          sitio = partes[2] || '-';
        } else if (codigo.includes('ST')) {
          sitio = codigo.replace(/[^0-9]/g, '') || '-';
        } else {
          parcela = codigo.replace(/[^0-9]/g, '') || '-';
        }

        const todosLosMeses = [
          'ENERO',
          'FEBRERO',
          'MARZO',
          'ABRIL',
          'MAYO',
          'JUNIO',
          'JULIO',
          'AGOSTO',
          'SEPTIEMBRE',
          'OCTUBRE',
          'NOVIEMBRE',
          'DICIEMBRE'
        ];

        const limpiarNumero = (valor) => {
          if (!valor) return 0;

          return Number(
            String(valor)
              .replace(/\$/g, '')
              .replace(/\./g, '')
              .replace(/,/g, '')
              .trim()
          ) || 0;
        };

        const valorMes = {
          ENERO: 10000,
          FEBRERO: 10000,
          MARZO: 5000,
          ABRIL: 5000,
          MAYO: 8000,
          JUNIO: 8000,
          JULIO: 8000,
          AGOSTO: 8000,
          SEPTIEMBRE: 8000,
          OCTUBRE: 8000,
          NOVIEMBRE: 8000,
          DICIEMBRE: 8000
        };

        const mesesPagados = todosLosMeses
          .filter((mes) => {
            const valor = fila[mes];
            return valor && String(valor).trim() !== '';
          })
          .map((mes) => ({
            mes: mes,
            monto: limpiarNumero(fila[mes]),
            montoEsperado: valorMes[mes] || 0,
            incompleto: limpiarNumero(fila[mes]) < (valorMes[mes] || 0)
          }));

        const mesesPendientes = [...new Set(
          todosLosMeses.filter((mes) => {
            return !mesesPagados.some((item) => item.mes === mes);
          })
        )];

        const totalPagado = mesesPagados.reduce(
          (total, item) => total + limpiarNumero(item.monto),
          0
        );

        const diferenciaMeses = mesesPagados.reduce(
          (total, item) => {
            const faltante = item.montoEsperado - item.monto;
            return total + (faltante > 0 ? faltante : 0);
          },
          0
        );

        const totalPendiente =
          mesesPendientes.reduce(
            (total, mes) => {
              const mesNormalizado = mes === 'MAYONESA' ? 'MAYO' : mes;
              return total + (valorMes[mesNormalizado] || 0);
            },
            0
          ) + diferenciaMeses;

        const cortaFuego = limpiarNumero(
          fila['CORTA FUEGO'] ??
          fila['CORTA\nFUEGO'] ??
          fila['CORTAFUEGO'] ??
          fila['CORTA  FUEGO'] ??
          fila['CORTA-FUEGO'] ??
          fila['CORTA_FUEGO'] ??
          fila['CORTA F'] ??
          fila['CUOTA EXTRA'] ??
          fila['EXTRA'] ??
          fila['CORTA'] ??
          fila['CORTA FUEGO '] ??
          fila[' CORTA FUEGO'] ??
          fila['CORTA FUEGO CLP'] ??
          0
        );

        const mesesPagadosCorregidos = mesesPagados;

        return {
          id: index + 1,
          nombre:
            fila['NOMBRE DE PROPIETARIO'] ||
            fila['PROPIETARIO'] ||
            `Vecino ${index + 1}`,
          parcela,
          sitio,
          monto: fila['TOTAL'] ? `$${fila['TOTAL']}` : '$0',
          estado: fila['ESTADO'] || 'Pendiente',
          mesesPagados: mesesPagadosCorregidos,
          mesesPendientes,
          totalPagado,
          totalPendiente: totalPendiente + cortaFuego,
          cortaFuego
        };
      });

      setVecinos(vecinosExcel);
  };

  const vecinosFiltrados = vecinos.filter((vecino) => {
    const hayFiltro =
      filtroParcela.trim() !== '' ||
      filtroSitio.trim() !== '' ||
      filtroNombre.trim() !== '';

    if (!hayFiltro) return false;

    const coincideParcela = filtroParcela
      ? vecino.parcela.includes(filtroParcela)
      : true;

    const coincideSitio = filtroSitio
      ? vecino.sitio.includes(filtroSitio)
      : true;

    const coincideNombre = filtroNombre
      ? filtroNombre
          .toLowerCase()
          .split(' ')
          .filter(Boolean)
          .every((parte) =>
            vecino.nombre.toLowerCase().includes(parte)
          )
      : true;

    return coincideParcela && coincideSitio && coincideNombre;
  });

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src="/logo-lomas-del-valle.jpg"
              alt="Logo"
              className="w-24 h-24 object-contain rounded-2xl bg-white p-2 shadow"
            />

            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-slate-900 leading-tight">
                Comunidad Lomas del Valle Longotoma
              </h1>
              <p className="text-slate-500 mt-2 text-lg">
                Busca vecinos por parcela o sitio y revisa su estado.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Buscar por Nombre Completo
              </label>
              <input
                type="text"
                placeholder="Ej: Juan Pérez González"
                value={filtroNombre}
                onChange={(e) => setFiltroNombre(e.target.value)}
                className="w-full border border-slate-300 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Buscar por Parcela
              </label>
              <input
                type="text"
                placeholder="Ej: 5"
                value={filtroParcela}
                onChange={(e) => setFiltroParcela(e.target.value)}
                className="w-full border border-slate-300 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Buscar por Sitio
              </label>
              <input
                type="text"
                placeholder="Ej: 6"
                value={filtroSitio}
                onChange={(e) => setFiltroSitio(e.target.value)}
                className="w-full border border-slate-300 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filtroParcela === '' && filtroSitio === '' && filtroNombre === '' ? (
              <div className="bg-slate-50 rounded-3xl p-10 text-center text-slate-500">
                Ingresa una parcela, sitio o nombre completo para buscar un vecino.
              </div>
            ) : vecinosFiltrados.length === 0 ? (
              <div className="bg-slate-50 rounded-3xl p-10 text-center text-slate-500">
                No se encontraron vecinos con esos filtros.
              </div>
            ) : (
              vecinosFiltrados.map((vecino) => (
                <div
                  key={vecino.id}
                  className="border border-slate-200 rounded-3xl p-6 shadow-sm bg-slate-50"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">
                        {vecino.nombre}
                      </h3>
                      <p className="text-slate-500 mt-1">
                        Parcela: {vecino.parcela} | Sitio: {vecino.sitio}
                      </p>
                    </div>

                    <span
                      className={`px-4 py-2 rounded-full text-sm font-medium ${
                        vecino.estado === 'Pagado'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {vecino.estado}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl p-4 border border-slate-200">
                      <p className="text-sm text-slate-500">Total pagado</p>
                      <p className="text-3xl font-bold text-emerald-700 mt-2">
                        ${vecino.totalPagado.toLocaleString('es-CL')}
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-slate-200">
                      <p className="text-sm text-slate-500">Total pendiente</p>
                      <p className="text-3xl font-bold text-red-600 mt-2">
                        ${vecino.totalPendiente.toLocaleString('es-CL')}
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-slate-200 md:col-span-3">
                      <p className="text-sm text-slate-500 mb-3">
                        Meses pagados
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {vecino.mesesPagados.length > 0 ? (
                          vecino.mesesPagados.map((item) => (
                            <span
                              key={item.mes}
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                item.incompleto
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {item.mes} - ${item.monto.toLocaleString('es-CL')} / ${item.montoEsperado.toLocaleString('es-CL')}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">
                            Sin pagos registrados
                          </span>
                        )}
                      </div>

                      <div className="mt-4 text-sm text-slate-600">
                        Total pagado registrado:
                        <span className="font-bold text-emerald-700 ml-1">
                          ${vecino.totalPagado.toLocaleString('es-CL')}
                        </span>
                      </div>

                      <div className="mt-6 bg-amber-100 border border-amber-300 rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-sm text-slate-600">
                              Cuota extra corta fuego
                            </p>
                            <p className="text-2xl font-bold text-amber-700 mt-1">
                              ${vecino.cortaFuego.toLocaleString('es-CL')}
                            </p>
                          </div>

                          <div>
                            <span className="bg-amber-200 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                              {vecino.cortaFuego > 0
                                ? 'Incluida en total pendiente'
                                : 'Sin cuota registrada'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-slate-500 mt-6 mb-3">
                        Meses pendientes
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {vecino.mesesPendientes.length > 0 ? (
                          vecino.mesesPendientes.map((mes) => (
                            <span
                              key={mes}
                              className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium"
                            >
                              {mes} - $
                              {(mes === 'ENERO' || mes === 'FEBRERO'
                                ? 10000
                                : mes === 'MARZO' || mes === 'ABRIL'
                                ? 5000
                                : 8000
                              ).toLocaleString('es-CL')}
                            </span>
                          ))
                        ) : (
                          <span className="text-emerald-600 font-medium">
                            No tiene meses pendientes
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
