const ANALYSIS_URL = import.meta.env.VITE_N8N_ANALYSIS_URL;
const GENERATE_DOC_URL = import.meta.env.VITE_N8N_GENERATE_DOC_URL;
const WEBHOOK_SECRET = import.meta.env.VITE_N8N_WEBHOOK_SECRET;

const MSG_IA_NO_DISPONIBLE = 'Hubo un problema con el servicio de IA (posiblemente créditos agotados o servicio no disponible). Por favor contacte a soporte.';

export const TIPO_ANALISIS = {
  PRELIMINAR: 'preliminar', // Fase 1: imágenes -> nombre + descripción
  PROFUNDO: 'profundo'      // Fase 2: solo texto -> riesgos + matriz NOM-004
};

/**
 * Envía un JSON al webhook de análisis de n8n y devuelve la respuesta ya parseada.
 * Convierte cualquier falla técnica en un mensaje entendible para el usuario.
 */
async function enviarAnalisis(payload) {
  let response;
  try {
    response = await fetch(ANALYSIS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Error de red al contactar n8n:', error);
    throw new Error('No se pudo conectar con el servicio de IA. Verifique su conexión o contacte a soporte.', { cause: error });
  }

  if (!response.ok) {
    console.error('n8n respondió con estado', response.status);
    if (response.status >= 500) throw new Error(MSG_IA_NO_DISPONIBLE);
    throw new Error(`Error en la respuesta del servidor: ${response.status}`);
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    console.error('n8n devolvió una respuesta vacía');
    throw new Error(MSG_IA_NO_DISPONIBLE);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('n8n devolvió una respuesta que no es JSON:', text.slice(0, 300));
    throw new Error('Hubo un problema al procesar con la IA. Es posible que los créditos se hayan agotado. Por favor contacte a soporte.');
  }

  // n8n a veces responde con un arreglo de items
  return Array.isArray(data) ? (data[0] ?? {}) : data;
}

/**
 * FASE 1 · Pre-análisis visual.
 * Envía únicamente URLs de imágenes (Supabase Storage 'equipos-fotos') y datos de referencia.
 * @returns {Promise<{ nombre_equipo: string, descripcion: string }>}
 */
export async function preAnalizarEquipo(datos) {
  const respuesta = await enviarAnalisis({ ...datos, tipo_analisis: TIPO_ANALISIS.PRELIMINAR });

  const nombre = respuesta.nombre_equipo ?? respuesta.equipo ?? respuesta.nombre ?? '';
  const descripcion = respuesta.descripcion ?? respuesta.descripcion_tecnica ?? '';

  if (!nombre && !descripcion) {
    throw new Error('La IA no devolvió el nombre ni la descripción del equipo. Intente de nuevo o capture los datos manualmente.');
  }

  return {
    nombre_equipo: String(nombre).trim(),
    descripcion: String(descripcion).trim()
  };
}

/**
 * FASE 2 · Análisis profundo (solo texto, sin imágenes).
 * Se usará desde "Mis Equipos" con el botón "Analizar Todos".
 * @returns {Promise<{ riesgos: object, matriz: object[] }>}
 */
export async function analizarEquipoProfundo(datos) {
  return enviarAnalisis({ ...datos, tipo_analisis: TIPO_ANALISIS.PROFUNDO });
}

/**
 * Envía el consolidado de datos de la empresa y equipos para generar el archivo Word
 */
export async function generarDocumentoWord(payloadCompleto) {
  try {
    const response = await fetch(GENERATE_DOC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(payloadCompleto)
    });

    if (!response.ok) {
      throw new Error(`Error al generar documento: ${response.status}`);
    }

    // Retorna el archivo binario (Blob) listo para descarga
    return await response.blob();
  } catch (error) {
    console.error('Error al solicitar documento a n8n:', error);
    throw error;
  }
}
