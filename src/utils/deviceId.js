export const getDeviceId = () => {
  let deviceId = localStorage.getItem('app_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('app_device_id', deviceId);
  }
  return deviceId;
};