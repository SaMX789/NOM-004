import { supabase } from './supabaseClient';

/**
 * Registro preliminar de equipos (Supabase Storage + tablas `equipos` y `equipos_imagenes` + webhook n8n).
 * Esquema de referencia: src/services/sqlspb.txt
 *
 * Reglas:
 *  - Las imágenes SIEMPRE se suben primero a Storage; a n8n solo viajan sus URLs públicas.
 *  - Este flujo NO escribe en `analisis_equipos` (reservada para el análisis NOM-004 completo).
 *  - Si algo falla después de subir archivos, se borran del bucket (rollback) y se propaga el error.
 */

const BUCKET = 'equipos-fotos';
const WEBHOOK_ANALISIS_PRE = import.meta.env.VITE_N8N_WEBHOOK_ANALISIS_PRE;
const TIMEOUT_IA_MS = 120_000;
const META_STORAGE_KEY = 'asci_equipos_meta_v1';

export const FASES = {
  SUBIENDO: 'subiendo',
  ANALIZANDO: 'analizando',
  GUARDANDO: 'guardando'
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

// Proyecto/estudio activo que guarda Datos Empresariales al presionar "Continuar / Entrar"
export const obtenerProyectoActivo = () => {
  try {
    const proyecto = JSON.parse(localStorage.getItem('proyecto_activo') || 'null');
    return proyecto?.evaluacion_id ? proyecto : null;
  } catch {
    return null;
  }
};

// Persistencia ligera de metadatos opcionales de referencia (Identificación y Área) por equipo
const leerMapaMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(META_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

export const obtenerMetaOpcional = (equipoId) => {
  if (!equipoId) return { identificacion: '', departamento: '' };
  const mapa = leerMapaMeta();
  const item = mapa[equipoId] || {};
  return {
    identificacion: item.identificacion || '',
    departamento: item.departamento || ''
  };
};

export const guardarMetaOpcional = (equipoId, { identificacion = '', departamento = '' } = {}) => {
  if (!equipoId) return;
  try {
    const mapa = leerMapaMeta();
    mapa[equipoId] = {
      identificacion: String(identificacion ?? '').trim(),
      departamento: String(departamento ?? '').trim()
    };
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(mapa));
  } catch {
    // Ignorar errores de almacenamiento local
  }
};

export const eliminarMetaOpcional = (equipoId) => {
  if (!equipoId) return;
  try {
    const mapa = leerMapaMeta();
    delete mapa[equipoId];
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(mapa));
  } catch {
    // Ignorar errores de almacenamiento local
  }
};

export const mensajeError = (error) => {
  if (!error) return 'Ocurrió un error inesperado.';
  if (error.code === '23503') return 'El estudio seleccionado ya no existe. Vuelve a Datos Empresariales y entra de nuevo.';
  if (error.code === '42501') return 'No tienes permisos para guardar este equipo (revisa las políticas RLS).';
  if (error.code === '23502') return 'Falta un dato obligatorio para guardar el equipo.';
  if (/failed to fetch|networkerror/i.test(error.message ?? '')) {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  return error.message || 'Ocurrió un error inesperado.';
};

const aTexto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/* ------------------------------------------------------------------ */
/* Supabase Storage                                                    */
/* ------------------------------------------------------------------ */

/**
 * Elimina archivos del bucket (best-effort: se usa en rollback y no debe ocultar el error original).
 * @param {string[]} rutas
 */
export const eliminarArchivos = async (rutas) => {
  const lista = (rutas ?? []).filter(Boolean);
  if (lista.length === 0) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(lista);
    if (error) console.warn('No se pudieron eliminar archivos huérfanos del bucket:', error);
  } catch (error) {
    console.warn('No se pudieron eliminar archivos huérfanos del bucket:', error);
  }
};

/**
 * Sube las imágenes (ya comprimidas) a `equipos-fotos/{userId}/equipos/...` y devuelve sus URLs públicas.
 * Si alguna falla, borra las que sí se subieron en esta llamada.
 * @param {File[]} archivos
 * @param {string} userId
 * @returns {Promise<{ path: string, nombre_archivo: string, url_publica: string }[]>}
 */
export const subirImagenes = async (archivos, userId) => {
  if (!userId) throw new Error('Tu sesión no es válida. Vuelve a iniciar sesión.');

  const subidas = [];
  try {
    for (const archivo of archivos) {
      const nombreArchivo = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.jpg`;
      const path = `${userId}/equipos/${nombreArchivo}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, archivo, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;

      subidas.push({
        path,
        nombre_archivo: nombreArchivo,
        url_publica: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      });
    }
    return subidas;
  } catch (error) {
    await eliminarArchivos(subidas.map((s) => s.path));
    throw new Error(`No se pudieron subir las imágenes: ${mensajeError(error)}`, { cause: error });
  }
};

/* ------------------------------------------------------------------ */
/* Webhook n8n · Análisis preliminar con IA                            */
/* ------------------------------------------------------------------ */

/**
 * POST al webhook con SOLO URLs públicas + el texto opcional del usuario.
 * @param {{ imagenes: string[], datos_usuario: { nombre: string, descripcion: string } }} payload
 * @returns {Promise<{ nombre: string, descripcion: string }>}
 */
export const analizarConIA = async ({ imagenes, datos_usuario }) => {
  if (!WEBHOOK_ANALISIS_PRE) {
    throw new Error('No está configurada la variable VITE_N8N_WEBHOOK_ANALISIS_PRE en el archivo .env.');
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_IA_MS);

  let respuesta;
  try {
    respuesta = await fetch(WEBHOOK_ANALISIS_PRE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagenes,
        datos_usuario: {
          nombre: aTexto(datos_usuario?.nombre),
          descripcion: aTexto(datos_usuario?.descripcion)
        }
      }),
      signal: controlador.signal
    });
  } catch (error) {
    console.error('Error al contactar el webhook de análisis IA:', error);
    throw new Error(
      error.name === 'AbortError'
        ? 'La IA tardó demasiado en responder. Inténtalo de nuevo.'
        : 'No se pudo conectar con el servidor de IA (error de red o SSL).',
      { cause: error }
    );
  } finally {
    clearTimeout(temporizador);
  }

  if (!respuesta.ok) {
    console.error('El webhook de análisis IA respondió con estado HTTP', respuesta.status);
    throw new Error(`El servidor de IA respondió con un error (${respuesta.status}).`);
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch (error) {
    throw new Error('La respuesta de la IA no es un JSON válido.', { cause: error });
  }

  // n8n puede devolver el objeto directo o un arreglo de items
  const resultado = Array.isArray(datos) ? datos[0] : datos;
  const nombre = aTexto(resultado?.nombre);
  const descripcion = aTexto(resultado?.descripcion);

  if (!nombre || !descripcion) {
    throw new Error('La IA respondió sin nombre o sin descripción del equipo.');
  }

  return { nombre, descripcion };
};

/* ------------------------------------------------------------------ */
/* Base de datos · `equipos` + `equipos_imagenes`                      */
/* ------------------------------------------------------------------ */

/**
 * Inserta el equipo y sus imágenes. Si falla el registro de imágenes, borra el equipo
 * (las FK con ON DELETE CASCADE limpian cualquier fila dependiente).
 * @returns {Promise<{ id: string }>}
 */
const insertarEquipo = async ({ fkEvaluacion, nombre, descripcion, imagenes }) => {
  const { data: equipo, error: errorEquipo } = await supabase
    .from('equipos')
    .insert({
      fk_evaluacion: fkEvaluacion,
      nombre_equipo: nombre,
      descripcion_equipo: descripcion,
      identificador_imagen: imagenes[0].nombre_archivo
    })
    .select('id')
    .single();
  if (errorEquipo) throw errorEquipo;

  const { error: errorImagenes } = await supabase.from('equipos_imagenes').insert(
    imagenes.map((img) => ({
      fk_equipo: equipo.id,
      nombre_archivo: img.nombre_archivo,
      url_publica: img.url_publica,
      file_id: img.path
    }))
  );

  if (errorImagenes) {
    await supabase.from('equipos').delete().eq('id', equipo.id);
    throw errorImagenes;
  }

  return equipo;
};

/* ------------------------------------------------------------------ */
/* Flujos de registro                                                  */
/* ------------------------------------------------------------------ */

const validarEntrada = ({ archivos, userId, fkEvaluacion }) => {
  if (!fkEvaluacion) throw new Error('No hay un estudio activo. Entra a un estudio desde Datos Empresariales.');
  if (!userId) throw new Error('Tu sesión no es válida. Vuelve a iniciar sesión.');
  if (!archivos || archivos.length < 1) throw new Error('Agrega al menos una fotografía del equipo.');
};

/**
 * Flujo A · "Analizar con IA".
 * Sube imágenes → envía URLs + texto opcional a n8n → guarda lo que devuelva la IA.
 */
export const registrarConIA = async ({
  archivos,
  userId,
  fkEvaluacion,
  nombre = '',
  descripcion = '',
  identificacion = '',
  departamento = '',
  onFase
}) => {
  validarEntrada({ archivos, userId, fkEvaluacion });

  onFase?.(FASES.SUBIENDO);
  const imagenes = await subirImagenes(archivos, userId);

  try {
    onFase?.(FASES.ANALIZANDO);
    const resultadoIA = await analizarConIA({
      imagenes: imagenes.map((img) => img.url_publica),
      datos_usuario: { nombre, descripcion }
    });

    onFase?.(FASES.GUARDANDO);
    const equipo = await insertarEquipo({
      fkEvaluacion,
      nombre: resultadoIA.nombre,
      descripcion: resultadoIA.descripcion,
      imagenes
    });

    guardarMetaOpcional(equipo.id, { identificacion, departamento });

    return { id: equipo.id, nombre: resultadoIA.nombre, descripcion: resultadoIA.descripcion };
  } catch (error) {
    await eliminarArchivos(imagenes.map((img) => img.path)); // rollback de archivos huérfanos
    throw error.code ? new Error(mensajeError(error), { cause: error }) : error;
  }
};

/**
 * Flujo B · "Guardar borrador" (sin IA, cero llamadas a n8n).
 * Exige al menos 1 imagen y nombre + descripción con contenido real.
 */
export const guardarBorrador = async ({
  archivos,
  userId,
  fkEvaluacion,
  nombre,
  descripcion,
  identificacion = '',
  departamento = '',
  onFase
}) => {
  validarEntrada({ archivos, userId, fkEvaluacion });

  const nombreLimpio = aTexto(nombre);
  const descripcionLimpia = aTexto(descripcion);
  if (!nombreLimpio || !descripcionLimpia) {
    throw new Error('Para guardar sin IA debes escribir el nombre y la descripción del equipo.');
  }

  onFase?.(FASES.SUBIENDO);
  const imagenes = await subirImagenes(archivos, userId);

  try {
    onFase?.(FASES.GUARDANDO);
    const equipo = await insertarEquipo({
      fkEvaluacion,
      nombre: nombreLimpio,
      descripcion: descripcionLimpia,
      imagenes
    });

    guardarMetaOpcional(equipo.id, { identificacion, departamento });

    return { id: equipo.id, nombre: nombreLimpio, descripcion: descripcionLimpia };
  } catch (error) {
    await eliminarArchivos(imagenes.map((img) => img.path)); // rollback de archivos huérfanos
    throw error.code ? new Error(mensajeError(error), { cause: error }) : error;
  }
};
