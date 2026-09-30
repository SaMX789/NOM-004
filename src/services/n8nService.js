const ANALYSIS_URL = import.meta.env.VITE_N8N_ANALYSIS_URL;
const GENERATE_DOC_URL = import.meta.env.VITE_N8N_GENERATE_DOC_URL;
const WEBHOOK_SECRET = import.meta.env.VITE_N8N_WEBHOOK_SECRET;

/**
 * Envia los datos del equipo a n8n para análisis con IA
 */
export async function analizarEquipoConIA(dataEquipo) {
  try {
    const response = await fetch(ANALYSIS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(dataEquipo)
    });

    if (!response.ok) {
      throw new Error(`Error en la respuesta del servidor: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error al analizar equipo con n8n:', error);
    throw error;
  }
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