import { supabase } from './supabaseClient';
import {
  eliminarArchivos,
  eliminarMetaOpcional,
  guardarMetaOpcional,
  obtenerMetaOpcional
} from './equiposService';

/**
 * Lectura/edición de equipos sobre el esquema definitivo (src/services/sqlspb.txt):
 *   equipos · equipos_imagenes · analisis_equipos
 *
 * Expone cada equipo con la forma que consume "Mis Equipos":
 *   { id, equipo, descripcion_manual, identificacion, departamento, imagenes_urls, status, riesgos, matriz }
 *   - status 'completado' <=> existe un registro en analisis_equipos para ese equipo.
 *   - riesgos / matriz viven en analisis_equipos.analysis (JSONB: { riesgos, matriz }).
 */

export const EQUIPO_STATUS = {
  BORRADOR: 'borrador',
  COMPLETADO: 'completado'
};

const SELECT_EQUIPO = '*, equipos_imagenes(*), analisis_equipos(*)';

const aError = (error, accion) => {
  console.error(`Supabase · error al ${accion}:`, error);
  return new Error(`No se pudo ${accion}: ${error.message}`, { cause: error });
};

const porFecha = (campo, direccion) => (a, b) =>
  direccion * (new Date(a[campo]).getTime() - new Date(b[campo]).getTime());

// Convierte una fila de `equipos` (con relaciones) a la forma que usa la UI
const adaptar = (fila) => {
  const imagenes = [...(fila.equipos_imagenes ?? [])].sort(porFecha('created_at', 1));
  const ultimoAnalisis = [...(fila.analisis_equipos ?? [])].sort(porFecha('created_at', -1))[0];
  const metaOpcional = obtenerMetaOpcional(fila.id);

  return {
    id: fila.id,
    fk_evaluacion: fila.fk_evaluacion,
    equipo: fila.nombre_equipo ?? '',
    descripcion_manual: fila.descripcion_equipo ?? '',
    identificacion: metaOpcional.identificacion,
    departamento: metaOpcional.departamento,
    imagenes,
    imagenes_urls: imagenes.map((img) => img.url_publica),
    status: ultimoAnalisis ? EQUIPO_STATUS.COMPLETADO : EQUIPO_STATUS.BORRADOR,
    riesgos: ultimoAnalisis?.analysis?.riesgos ?? null,
    matriz: ultimoAnalisis?.analysis?.matriz ?? null,
    created_at: fila.fecha_insercion
  };
};

const obtenerAdaptado = async (id) => {
  const { data, error } = await supabase.from('equipos').select(SELECT_EQUIPO).eq('id', id).single();
  if (error) throw aError(error, 'obtener el equipo');
  return adaptar(data);
};

export const dbService = {
  /** Lista los equipos de una evaluación (estudio), del más antiguo al más reciente. */
  async obtenerPorEvaluacion(fkEvaluacion) {
    if (!fkEvaluacion) throw new Error('No hay un estudio activo seleccionado.');

    const { data, error } = await supabase
      .from('equipos')
      .select(SELECT_EQUIPO)
      .eq('fk_evaluacion', fkEvaluacion)
      .order('fecha_insercion', { ascending: true });
    if (error) throw aError(error, 'obtener los equipos');

    return (data ?? []).map(adaptar);
  },

  /**
   * Guarda la edición manual de nombre, descripción, identificación (opcional) y área (opcional).
   */
  async guardarBorrador(equipoLocal) {
    const { error } = await supabase
      .from('equipos')
      .update({
        nombre_equipo: (equipoLocal.equipo ?? '').trim(),
        descripcion_equipo: (equipoLocal.descripcion_manual ?? '').trim()
      })
      .eq('id', equipoLocal.id);
    if (error) throw aError(error, 'actualizar el equipo');

    guardarMetaOpcional(equipoLocal.id, {
      identificacion: equipoLocal.identificacion,
      departamento: equipoLocal.departamento
    });

    return obtenerAdaptado(equipoLocal.id);
  },

  /** Guarda el análisis profundo en `analisis_equipos` (reemplaza uno previo del mismo equipo). */
  async marcarCompletado(id, { riesgos, matriz }) {
    const { error: errorBorrado } = await supabase.from('analisis_equipos').delete().eq('fk_equipo', id);
    if (errorBorrado) throw aError(errorBorrado, 'reemplazar el análisis anterior');

    const { error } = await supabase
      .from('analisis_equipos')
      .insert({ fk_equipo: id, analysis: { riesgos, matriz } });
    if (error) throw aError(error, 'guardar el análisis del equipo');

    return obtenerAdaptado(id);
  },

  /** Descarta el análisis para que el equipo vuelva a ser un borrador editable. */
  async reabrirComoBorrador(id) {
    const { error } = await supabase.from('analisis_equipos').delete().eq('fk_equipo', id);
    if (error) throw aError(error, 'reabrir el equipo como borrador');

    return obtenerAdaptado(id);
  },

  /** Elimina el equipo (CASCADE borra imágenes y análisis) y sus archivos del bucket. */
  async eliminarEquipo(id) {
    const { data: imagenes } = await supabase.from('equipos_imagenes').select('file_id').eq('fk_equipo', id);

    const { data: borrados, error } = await supabase.from('equipos').delete().eq('id', id).select('id');
    if (error) throw aError(error, 'eliminar el equipo');
    if (!borrados || borrados.length === 0) {
      throw new Error('No se pudo eliminar el equipo (no existe o no tienes permisos).');
    }

    eliminarMetaOpcional(id);
    await eliminarArchivos((imagenes ?? []).map((img) => img.file_id));
  }
};
