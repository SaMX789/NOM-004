// Webhooks independientes por fase (con fallback a VITE_N8N_ANALYSIS_URL por compatibilidad)
const PRE_ANALYSIS_URL = import.meta.env.VITE_N8N_PRE_ANALYSIS_URL || import.meta.env.VITE_N8N_ANALYSIS_URL;
const DEEP_ANALYSIS_URL = import.meta.env.VITE_N8N_DEEP_ANALYSIS_URL || import.meta.env.VITE_N8N_ANALYSIS_URL;
const GENERATE_DOC_URL = import.meta.env.VITE_N8N_GENERATE_DOC_URL;
const WEBHOOK_SECRET = import.meta.env.VITE_N8N_WEBHOOK_SECRET;

const MSG_IA_NO_DISPONIBLE = 'Hubo un problema con el servicio de IA (posiblemente créditos agotados o servicio no disponible). Por favor contacte a soporte.';

export const TIPO_ANALISIS = {
  PRELIMINAR: 'preliminar', // Webhook 1 (Fase 1): imágenes -> nombre_equipo + descripcion
  PROFUNDO: 'profundo'      // Webhook 2 (Fase 2): solo texto -> riesgos + matriz NOM-004
};

/**
 * Crea un Error enriquecido para distinguir fallos de red/SSL (Failed to fetch)
 * de errores propios de negocio o de respuesta inválida.
 */
function crearErrorWebhook(mensaje, { isNetworkError = false, status = null, cause = null } = {}) {
  const err = new Error(mensaje, cause ? { cause } : undefined);
  err.isNetworkError = isNetworkError;
  err.status = status;
  return err;
}

/**
 * Cliente HTTP genérico para los Webhooks JSON de n8n (Fases 1 y 2).
 */
async function postJsonWebhook(url, payload, nombreFase) {
  if (!url) {
    throw crearErrorWebhook(
      `No está configurada la URL del webhook para ${nombreFase} en el archivo .env.`,
      { isNetworkError: true }
    );
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WEBHOOK_SECRET ? { 'X-Webhook-Secret': WEBHOOK_SECRET } : {})
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    // Captura TypeError: Failed to fetch, ERR_SSL_PROTOCOL_ERROR, timeouts o caídas de DNS
    console.error(`Error de red/SSL al contactar n8n (${nombreFase}):`, error);
    throw crearErrorWebhook(
      'No se pudo conectar con el servidor de IA (error de red o SSL).',
      { isNetworkError: true, cause: error }
    );
  }

  if (!response.ok) {
    console.error(`n8n (${nombreFase}) respondió con estado HTTP`, response.status);
    if (response.status >= 500) {
      throw crearErrorWebhook(MSG_IA_NO_DISPONIBLE, { status: response.status });
    }
    throw crearErrorWebhook(`Error en la respuesta del servidor (${response.status}).`, {
      status: response.status
    });
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    console.error(`n8n (${nombreFase}) devolvió una respuesta vacía`);
    throw crearErrorWebhook(MSG_IA_NO_DISPONIBLE, { status: response.status });
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    console.error(`n8n (${nombreFase}) devolvió contenido no JSON:`, text.slice(0, 300));
    throw crearErrorWebhook(
      'Hubo un problema al procesar la respuesta de la IA. Es posible que los créditos se hayan agotado.',
      { cause: error }
    );
  }

  // Si n8n devuelve un arreglo de items (ej. [{ ... }]), tomamos el primer elemento
  return Array.isArray(data) ? (data[0] ?? {}) : data;
}

/**
 * WEBHOOK 1 · FASE 1: Pre-análisis visual.
 * Envía las URLs públicas de Supabase Storage ('equipos-fotos') y metadatos opcionales.
 * Devuelve únicamente { nombre_equipo, descripcion }.
 * @param {{ user_id: string, equipo_id?: string|null, identificacion?: string, departamento?: string, imagenes_urls: string[] }} datos
 * @returns {Promise<{ nombre_equipo: string, descripcion: string }>}
 */
export async function preAnalizarEquipo(datos) {
  const respuesta = await postJsonWebhook(
    PRE_ANALYSIS_URL,
    { ...datos, tipo_analisis: TIPO_ANALISIS.PRELIMINAR },
    'Pre-análisis (Fase 1)'
  );

  const nombre = respuesta.nombre_equipo ?? respuesta.equipo ?? respuesta.nombre ?? '';
  const descripcion = respuesta.descripcion ?? respuesta.descripcion_tecnica ?? '';

  if (!nombre && !descripcion) {
    throw crearErrorWebhook(
      'La IA respondió sin nombre ni descripción del equipo. Puedes capturarlos manualmente.'
    );
  }

  return {
    nombre_equipo: String(nombre).trim(),
    descripcion: String(descripcion).trim()
  };
}

/**
 * WEBHOOK 2 · FASE 2: Análisis profundo en texto (1 solo equipo a la vez, sin imágenes).
 * Recibe la descripción revisada y las condiciones de operación (operadores, días, horas al día).
 * Devuelve { riesgos, matriz } conforme a la NOM-004-STPS-1999.
 * @param {{
 *   user_id: string,
 *   equipo_id: string,
 *   equipo: string,
 *   identificacion?: string,
 *   departamento?: string,
 *   descripcion: string,
 *   operadores: number|null,
 *   dias: string[],
 *   horas: number|null
 * }} datosExposicion
 * @returns {Promise<{ riesgos: object, matriz: object[] }>}
 */
export async function analizarEquipoProfundo(datosExposicion) {
  const respuesta = await postJsonWebhook(
    DEEP_ANALYSIS_URL,
    { ...datosExposicion, tipo_analisis: TIPO_ANALISIS.PROFUNDO },
    'Análisis Profundo (Fase 2)'
  );

  const riesgos = respuesta.riesgos && typeof respuesta.riesgos === 'object' ? respuesta.riesgos : {};
  const matriz = Array.isArray(respuesta.matriz) ? respuesta.matriz : [];

  if (Object.keys(riesgos).length === 0 && matriz.length === 0) {
    throw crearErrorWebhook(
      'El análisis profundo no devolvió matriz ni evaluación de riesgos para este equipo.'
    );
  }

  return { riesgos, matriz };
}

/**
 * WEBHOOK 3 · FASE 3: Generación de Documento Word.
 * Envía el arreglo completo de equipos con status 'completado' y los datos de la empresa.
 */
export async function generarDocumentoWord(payloadCompleto) {
  if (!GENERATE_DOC_URL) {
    throw crearErrorWebhook(
      'No está configurada la URL VITE_N8N_GENERATE_DOC_URL en el archivo .env.',
      { isNetworkError: true }
    );
  }

  let response;
  try {
    response = await fetch(GENERATE_DOC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WEBHOOK_SECRET ? { 'X-Webhook-Secret': WEBHOOK_SECRET } : {})
      },
      body: JSON.stringify(payloadCompleto)
    });
  } catch (error) {
    console.error('Error de red/SSL al solicitar documento Word a n8n:', error);
    throw crearErrorWebhook(
      'No se pudo conectar con el servidor de generación de documentos (error de red o SSL).',
      { isNetworkError: true, cause: error }
    );
  }

  if (!response.ok) {
    throw crearErrorWebhook(`Error al generar documento: ${response.status}`, {
      status: response.status
    });
  }

  return await response.blob();
}
