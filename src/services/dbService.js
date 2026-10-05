import localforage from 'localforage';
import { getDeviceId } from '../utils/deviceId';

localforage.config({
  name: 'NOM004_App',
  storeName: 'borradores_equipos'
});

export const guardarBorradorLocal = async (equipos) => {
  const deviceId = getDeviceId();
  await localforage.setItem(`draft_${deviceId}`, equipos);
};

export const cargarBorradorLocal = async () => {
  const deviceId = getDeviceId();
  const data = await localforage.getItem(`draft_${deviceId}`);
  return data || [];
};

export const limpiarBorradorLocal = async () => {
  const deviceId = getDeviceId();
  await localforage.removeItem(`draft_${deviceId}`);
};