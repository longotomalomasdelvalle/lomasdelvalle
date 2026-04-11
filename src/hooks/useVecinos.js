import { useEffect, useState } from 'react';
import { normalizarConfiguracionColumnas } from '../utils/columnas.js';
import { crearVecino } from '../utils/pagos.js';

export default function useVecinos() {
  const [vecinos, setVecinos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  async function cargarVecinos() {
    try {
      setCargando(true);
      setErrorCarga('');

      const response = await fetch('/api/vecinos');

      if (!response.ok) {
        throw new Error('No se encontraron datos de vecinos.');
      }

      const data = await response.json();
      const filas = Array.isArray(data.filas) ? data.filas : [];
      const configuracion = normalizarConfiguracionColumnas(data.configuracion, filas);

      setVecinos(filas.map((fila, index) => crearVecino(fila, index, configuracion)));
    } catch (error) {
      console.error('Error cargando vecinos', error);
      setErrorCarga('No se pudo cargar la planilla de vecinos desde el servidor.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarVecinos();
  }, []);

  return {
    vecinos,
    cargando,
    errorCarga,
    recargar: cargarVecinos
  };
}
