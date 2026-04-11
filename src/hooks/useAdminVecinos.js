import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  normalizarConfiguracionColumnas,
  normalizarNombreColumna,
  COLUMNA_ACTUALIZACION
} from '../utils/columnas.js';
import {
  crearFilaEditable,
  esFilaFantasma,
  formatearContactoEditable,
  formatearRutEditable,
  normalizarFilaEditable
} from '../utils/adminRows.js';
import { exportarFilasAExcel, exportarFilasAJson } from '../utils/exportadores.js';

async function leerRespuestaJson(response) {
  try {
    return await response.json();
  } catch {
    return {
      ok: false,
      message: 'La respuesta del servidor no fue valida.'
    };
  }
}

function mensajeErrorHttp(response, fallback) {
  if (response.status === 404) {
    return 'Ruta no encontrada. Reinicia `npm run dev:server` para cargar los ultimos cambios del backend.';
  }

  return fallback;
}

export default function useAdminVecinos(logueado, onPersistSuccess) {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [filasModificadas, setFilasModificadas] = useState([]);
  const [configuracion, setConfiguracion] = useState(
    normalizarConfiguracionColumnas()
  );

  function marcarFilaActualizada(fila) {
    return {
      ...fila,
      [COLUMNA_ACTUALIZACION]: new Date().toISOString()
    };
  }

  useEffect(() => {
    if (!logueado) {
      setFilas([]);
      setConfiguracion(normalizarConfiguracionColumnas());
      setFilasModificadas([]);
      setMensaje('');
      setError('');
      return;
    }

    cargarFilas();
  }, [logueado]);

  async function cargarFilas() {
    try {
      setCargando(true);
      setError('');

      const response = await fetch('/api/admin/vecinos', {
        credentials: 'same-origin'
      });
      const data = await leerRespuestaJson(response);

      if (!response.ok || !data.ok) {
        setError(data.message || mensajeErrorHttp(response, 'No se pudieron cargar los vecinos.'));
        return;
      }

      const configuracionNormalizada = normalizarConfiguracionColumnas(data.configuracion, data.filas);
      setConfiguracion(configuracionNormalizada);
      setFilas(
        data.filas
          .map((fila) => normalizarFilaEditable(fila, configuracionNormalizada))
          .filter((fila) => !esFilaFantasma(fila))
      );
      setFilasModificadas([]);
    } catch (fetchError) {
      console.error('Error cargando filas admin', fetchError);
      setError('No se pudieron cargar los vecinos.');
    } finally {
      setCargando(false);
    }
  }

  function actualizarCelda(index, campo, valor, opciones = {}) {
    if (index === -1 && campo === '__add_column__') {
      const nombreColumna = normalizarNombreColumna(valor);

      if (!nombreColumna) {
        return;
      }

      const siguientesFilas = filas.map((fila) => ({
        ...marcarFilaActualizada(fila),
        [nombreColumna]: fila[nombreColumna] ?? ''
      }));

      setFilas(siguientesFilas);
      setFilasModificadas((actuales) => [
        ...new Set([...actuales, ...siguientesFilas.map((_, indice) => indice)])
      ]);
      setConfiguracion((actual) =>
        normalizarConfiguracionColumnas(
          {
            ...actual,
            cuotasExtra:
              opciones.tipo === 'cuota'
                ? [...actual.cuotasExtra, nombreColumna]
                : actual.cuotasExtra,
            camposTransversales:
              opciones.tipo === 'transversal'
                ? [...actual.camposTransversales, nombreColumna]
                : actual.camposTransversales
          },
          siguientesFilas
        )
      );
      return;
    }

    const valorNormalizado =
      campo === 'RUT'
        ? formatearRutEditable(valor)
        : campo === 'N-CONTACTO'
          ? formatearContactoEditable(valor)
          : valor;

    setFilas((actuales) =>
      actuales.map((fila, filaIndex) =>
        filaIndex === index ? { ...fila, [campo]: valorNormalizado } : fila
      )
    );
    setFilasModificadas((actuales) => [...new Set([...actuales, index])]);
  }

  function eliminarColumnaConfigurada(nombreColumna, tipo = 'cuota') {
    const nombre = normalizarNombreColumna(nombreColumna);

    const siguientesFilas = filas.map((fila) => {
      const siguiente = { ...fila };
      delete siguiente[nombre];
      return siguiente;
    });

    setFilas(siguientesFilas);
    setFilasModificadas((actuales) => [
      ...new Set([...actuales, ...siguientesFilas.map((_, indice) => indice)])
    ]);
    setConfiguracion((actual) =>
      normalizarConfiguracionColumnas(
        {
          ...actual,
          cuotasExtra:
            tipo === 'cuota'
              ? actual.cuotasExtra.filter((columna) => columna !== nombre)
              : actual.cuotasExtra,
          camposTransversales:
            tipo === 'transversal'
              ? actual.camposTransversales.filter((columna) => columna !== nombre)
              : actual.camposTransversales
        },
        siguientesFilas
      )
    );
    setMensaje(
      `${tipo === 'cuota' ? 'Cuota extra' : 'Campo transversal'} ${nombre} eliminad${tipo === 'cuota' ? 'a' : 'o'} de la grilla.`
    );
    setError('');
  }

  function agregarFila() {
    setFilas((actuales) => [...actuales, marcarFilaActualizada(crearFilaEditable(configuracion))]);
    setFilasModificadas([]);
  }

  function eliminarFila(index) {
    setFilas((actuales) => actuales.filter((_, filaIndex) => filaIndex !== index));
    setFilasModificadas((actuales) => actuales.filter((filaIndex) => filaIndex !== index));
  }

  function reemplazarFila(index, fila) {
    setFilas((actuales) =>
      actuales.map((actual, filaIndex) => (filaIndex === index ? fila : actual))
    );
    setFilasModificadas((actuales) => actuales.filter((filaIndex) => filaIndex !== index));
  }

  async function normalizarPlanilla() {
    try {
      setGuardando(true);
      setError('');
      setMensaje('');

      const response = await fetch('/api/admin/vecinos/normalizar', {
        method: 'POST',
        credentials: 'same-origin'
      });

      const data = await leerRespuestaJson(response);

      if (!response.ok || !data.ok) {
        setError(
          data.message || mensajeErrorHttp(response, 'No se pudo normalizar la planilla.')
        );
        return false;
      }

      const configuracionNormalizada = normalizarConfiguracionColumnas(
        data.configuracion,
        data.filas
      );
      setConfiguracion(configuracionNormalizada);
      setFilas(
        data.filas.map((fila) => normalizarFilaEditable(fila, configuracionNormalizada))
      );
      setFilasModificadas([]);
      setMensaje('Planilla normalizada correctamente.');
      await onPersistSuccess?.();
      return true;
    } catch (fetchError) {
      console.error('Error normalizando planilla', fetchError);
      setError('No se pudo normalizar la planilla.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardarFilas(mensajeExito = 'Cambios guardados correctamente.') {
    try {
      setGuardando(true);
      setError('');
      setMensaje('');

      const response = await fetch('/api/admin/vecinos', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filas: filas
            .map((fila, index) =>
              normalizarFilaEditable(
                filasModificadas.includes(index) ? marcarFilaActualizada(fila) : fila,
                configuracion
              )
            )
            .filter((fila) => !esFilaFantasma(fila)),
          configuracion
        })
      });

      const data = await leerRespuestaJson(response);

      if (!response.ok || !data.ok) {
        setError(
          data.message || mensajeErrorHttp(response, 'No se pudieron guardar los cambios.')
        );
        return false;
      }

      const configuracionNormalizada = normalizarConfiguracionColumnas(
        data.configuracion,
        data.filas
      );
      setConfiguracion(configuracionNormalizada);
      setFilas(
        data.filas
          .map((fila) => normalizarFilaEditable(fila, configuracionNormalizada))
          .filter((fila) => !esFilaFantasma(fila))
      );
      setFilasModificadas([]);
      setMensaje(mensajeExito);
      await onPersistSuccess?.();
      return true;
    } catch (fetchError) {
      console.error('Error guardando filas admin', fetchError);
      setError('No se pudieron guardar los cambios.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function importarExcel(file) {
    try {
      setGuardando(true);
      setError('');
      setMensaje('');

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames?.length) {
        setError('El archivo Excel no tiene hojas.');
        return false;
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!worksheet) {
        setError('No se pudo leer la hoja principal del Excel.');
        return false;
      }

      const filasImportadasCrudas = XLSX.utils.sheet_to_json(worksheet);
      const configuracionImportada = normalizarConfiguracionColumnas(
        configuracion,
        filasImportadasCrudas
      );
      const filasImportadas = filasImportadasCrudas.map((fila) =>
        marcarFilaActualizada(normalizarFilaEditable(fila, configuracionImportada))
      );

      const response = await fetch('/api/admin/vecinos/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filas: filasImportadas.map((fila) => normalizarFilaEditable(fila, configuracionImportada)),
          configuracion: configuracionImportada
        })
      });

      const payload = await leerRespuestaJson(response);

      if (!response.ok || !payload.ok) {
        setError(
          payload.message || mensajeErrorHttp(response, 'No se pudo importar el Excel.')
        );
        return false;
      }

      const configuracionNormalizada = normalizarConfiguracionColumnas(
        payload.configuracion,
        payload.filas
      );
      setConfiguracion(configuracionNormalizada);
      setFilas(
        payload.filas
          .map((fila) => normalizarFilaEditable(fila, configuracionNormalizada))
          .filter((fila) => !esFilaFantasma(fila))
      );
      setFilasModificadas([]);
      setMensaje('Excel importado correctamente.');
      await onPersistSuccess?.();
      return true;
    } catch (fetchError) {
      console.error('Error importando Excel', fetchError);
      setError('No se pudo importar el Excel.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  function exportarExcel() {
    exportarFilasAExcel(filas);
    setMensaje('Excel exportado correctamente.');
    setError('');
  }

  function exportarJson() {
    exportarFilasAJson(filas);
    setMensaje('Respaldo JSON exportado correctamente.');
    setError('');
  }

  return {
    filas,
    configuracion,
    cargando,
    guardando,
    mensaje,
    error,
    actualizarCelda,
    eliminarColumnaConfigurada,
    agregarFila,
    eliminarFila,
    reemplazarFila,
    guardarFilas,
    normalizarPlanilla,
    importarExcel,
    exportarExcel,
    exportarJson,
    recargar: cargarFilas
  };
}
