import localforage from 'localforage';

localforage.config({
  name: 'NOM004_App',
  storeName: 'equipos_borradores'
});

export const cargarBorradorLocal = async (key = 'borrador_actual') => {
  try {
    return await localforage.getItem(key);
  } catch (error) {
    console.error("Error al cargar borrador local:", error);
    return null;
  }
};

export const guardarBorradorLocal = async (datos, key = 'borrador_actual') => {
  try {
    return await localforage.setItem(key, datos);
  } catch (error) {
    console.error("Error al guardar borrador local:", error);
  }
};

export const dbService = {
  async obtenerTodos() {
    const equipos = [];
    try {
      await localforage.iterate((value, key) => {
        if (key !== 'borrador_actual') {
          equipos.push(value);
        }
      });
    } catch (error) {
      console.error("Error al obtener todos los equipos:", error);
    }
    return equipos;
  },

  // CORREGIDO: Prioriza 'equipo.id'. Si no existe, genera un ID único con Timestamp + Random
  async guardarEquipo(equipo) {
    try {
      const idUnico = equipo.id || `eq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const equipoConId = { ...equipo, id: idUnico };
      await localforage.setItem(idUnico, equipoConId);
      return equipoConId;
    } catch (error) {
      console.error("Error al guardar el equipo:", error);
    }
  },

  async eliminarEquipo(id) {
    try {
      await localforage.removeItem(id);
    } catch (error) {
      console.error("Error al eliminar el equipo:", error);
    }
  },

  async obtenerPorId(id) {
    try {
      return await localforage.getItem(id);
    } catch (error) {
      console.error("Error al obtener el equipo:", error);
      return null;
    }
  }
};