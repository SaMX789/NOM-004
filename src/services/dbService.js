import { supabase } from './supabaseClient';

const TABLA = 'equipos';

export const EQUIPO_STATUS = {
  BORRADOR: 'borrador',
  COMPLETADO: 'completado'
};

// Campos que el usuario puede capturar/editar mientras el equipo está en borrador
// (Fase 1: datos de la IA · Fase 2: condiciones de operación)
const CAMPOS_EDITABLES = [
  'equipo',
  'descripcion_manual',
  'identificacion',
  'departamento',
  'imagenes_urls',
  'operadores',
  'dias',
  'horas'
];

const CAMPOS_NUMERICOS = ['operadores', 'horas'];

const requerirUsuario = (userId) => {
  if (!userId) throw new Error('Tu sesión no es válida. Vuelve a iniciar sesión.');
};

const aError = (error, accion) => {
  console.error(`Supabase · error al ${accion}:`, error);
  return new Error(`No se pudo ${accion}: ${error.message}`, { cause: error });
};

// Toma solo los campos permitidos y convierte '' -> null en los numéricos
const normalizar = (datos) => {
  const limpio = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] === undefined) continue;
    let valor = datos[campo];
    if (CAMPOS_NUMERICOS.includes(campo)) {
      valor = valor === '' || valor === null ? null : Number(valor);
    }
    limpio[campo] = valor;
  }
  return limpio;
};

export const dbService = {
  /**
   * Lista los equipos del usuario. Opcionalmente filtra por status.
   * @param {string} userId
   * @param {{ status?: 'borrador' | 'completado' }} [opciones]
   */
  async obtenerTodos(userId, { status } = {}) {
    requerirUsuario(userId);
    let query = supabase
      .from(TABLA)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw aError(error, 'obtener los equipos');
    return data ?? [];
  },

  async obtenerPorId(userId, id) {
    requerirUsuario(userId);
    const { data, error } = await supabase
      .from(TABLA)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw aError(error, 'obtener el equipo');
    return data;
  },

  /**
   * Crea o actualiza un equipo y lo deja en status 'borrador'.
   * Cualquier cambio en los datos de entrada invalida un análisis previo,
   * por eso un equipo 'completado' que se edita vuelve a 'borrador'.
   * Los campos no enviados (riesgos, matriz, etc.) se conservan.
   */
  async guardarBorrador(userId, { id, ...datos }) {
    requerirUsuario(userId);
    const registro = { ...normalizar(datos), status: EQUIPO_STATUS.BORRADOR };

    if (id) {
      const { data, error } = await supabase
        .from(TABLA)
        .update(registro)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw aError(error, 'actualizar el borrador');
      return data;
    }

    const { data, error } = await supabase
      .from(TABLA)
      .insert({ ...registro, user_id: userId })
      .select()
      .single();
    if (error) throw aError(error, 'guardar el borrador');
    return data;
  },

  /**
   * Fase 2: guarda el resultado del análisis profundo y marca el equipo como 'completado'.
   */
  async marcarCompletado(userId, id, { riesgos, matriz }) {
    requerirUsuario(userId);
    const { data, error } = await supabase
      .from(TABLA)
      .update({ riesgos, matriz, status: EQUIPO_STATUS.COMPLETADO })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw aError(error, 'guardar el análisis del equipo');
    return data;
  },

  async eliminarEquipo(userId, id) {
    requerirUsuario(userId);
    const { error } = await supabase
      .from(TABLA)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw aError(error, 'eliminar el equipo');
  }
};
