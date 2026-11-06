import imageCompression from 'browser-image-compression';
import { supabase } from './supabaseClient';

const BUCKET_NAME = 'equipos-fotos';

const OPCIONES_COMPRESION = {
  maxSizeMB: 0.5,          // Máximo 500 KB (0.5 MB) por foto
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.75
};

/**
 * Comprime la imagen (máx. 0.5 MB) y la sube a Supabase Storage (bucket 'equipos-fotos').
 * Retorna la URL pública del archivo.
 * @param {File} file
 * @param {string} userId
 * @param {string} [carpeta='imagenes']
 * @returns {Promise<string>}
 */
export const subirImagenSupabase = async (file, userId, carpeta = 'imagenes') => {
  if (!userId) throw new Error('Tu sesión no es válida. Vuelve a iniciar sesión.');
  if (!file) throw new Error('No se recibió ningún archivo para subir.');

  try {
    // Asegura que toda foto que suba al bucket esté comprimida a <= 0.5 MB
    const archivoComprimido = await imageCompression(file, OPCIONES_COMPRESION);

    const fileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.jpg`;
    const filePath = `${userId}/${carpeta}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, archivoComprimido, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error al comprimir o subir imagen a Supabase Storage:', error);
    throw new Error(`No se pudo subir la imagen a la nube: ${error.message}`, { cause: error });
  }
};
