import { supabase } from './supabaseClient';
import { getDeviceId } from '../utils/deviceId';

const BUCKET_NAME = 'reportes-nom004';

export const subirArchivoSupabase = async (file, folder = 'manuales') => {
  const deviceId = getDeviceId();
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
  const filePath = `anonimo/${deviceId}/${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { upsert: true });

  if (error) {
    throw new Error(`Error al subir archivo a la nube: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};