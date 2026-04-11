import { useEffect, useState } from 'react';

export default function useAdminSession() {
  const [logueado, setLogueado] = useState(false);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [cargandoLogin, setCargandoLogin] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');
  const [resumenAdmin, setResumenAdmin] = useState(null);

  useEffect(() => {
    async function cargarSesion() {
      try {
        setCargandoSesion(true);

        const response = await fetch('/api/admin/session', {
          credentials: 'same-origin'
        });

        if (!response.ok) {
          setLogueado(false);
          setResumenAdmin(null);
          return;
        }

        const data = await response.json();

        if (!data.ok) {
          setLogueado(false);
          setResumenAdmin(null);
          return;
        }

        setLogueado(true);
        await cargarResumen();
      } catch (error) {
        console.error('Error verificando sesion admin', error);
        setLogueado(false);
        setResumenAdmin(null);
      } finally {
        setCargandoSesion(false);
      }
    }

    cargarSesion();
  }, []);

  async function cargarResumen() {
    try {
      const response = await fetch('/api/admin/resumen', {
        credentials: 'same-origin'
      });

      if (!response.ok) {
        setResumenAdmin(null);
        return null;
      }

      const data = await response.json();

      if (!data.ok) {
        setResumenAdmin(null);
        return null;
      }

      setResumenAdmin(data.resumen);
      return data.resumen;
    } catch (error) {
      console.error('Error cargando resumen admin', error);
      setResumenAdmin(null);
      return null;
    }
  }

  async function iniciarSesion(usuario, clave) {
    setCargandoLogin(true);
    setErrorLogin('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usuario, clave })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setLogueado(false);
        setResumenAdmin(null);
        setErrorLogin(data.message || 'No se pudo iniciar sesion.');
        return false;
      }

      setLogueado(true);
      await cargarResumen();
      return true;
    } catch (error) {
      console.error('Error iniciando sesion admin', error);
      setLogueado(false);
      setResumenAdmin(null);
      setErrorLogin('No se pudo conectar con el servidor de autenticacion.');
      return false;
    } finally {
      setCargandoLogin(false);
    }
  }

  async function cerrarSesion() {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    } catch (error) {
      console.error('Error cerrando sesion admin', error);
    } finally {
      setLogueado(false);
      setResumenAdmin(null);
      setErrorLogin('');
    }
  }

  return {
    logueado,
    cargandoSesion,
    cargandoLogin,
    errorLogin,
    resumenAdmin,
    iniciarSesion,
    cerrarSesion
  };
}
