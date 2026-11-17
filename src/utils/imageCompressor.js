import imageCompression from 'browser-image-compression';

export const OPCIONES_COMPRESION = {
  maxSizeMB: 0.5,          // Máximo 500 KB por foto para cuidar el 1 GB de Supabase Storage
  maxWidthOrHeight: 1280,  // Redimensiona manteniendo proporción
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.75
};

/**
 * Comprime una imagen en el navegador usando browser-image-compression (máx. 0.5 MB).
 * @param {File} file
 * @returns {Promise<File>}
 */
export const comprimirImagen = async (file) => {
  const blobComprimido = await imageCompression(file, OPCIONES_COMPRESION);
  const nombreBase = (file.name || 'equipo').replace(/\.[^/.]+$/, '');
  return new File([blobComprimido], `${nombreBase}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
};
