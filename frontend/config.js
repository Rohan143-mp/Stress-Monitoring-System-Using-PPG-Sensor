// Centralized configuration for the API URL
// The ESP32 now sends data to BOTH local and cloud simultaneously.
// Toggle USE_CLOUD to choose which backend this frontend app displays data from.

const USE_CLOUD = false;

const LOCAL_IP = "10.28.194.118";
const RENDER_URL = "https://stress-monitoring-system-using-ppg-sensor.onrender.com";

export const API_BASE_URL = USE_CLOUD ? RENDER_URL : `http://${LOCAL_IP}:5000`;

export const API_ENDPOINTS = {
    PREDICT: `${API_BASE_URL}/predict`,
    LATEST: `${API_BASE_URL}/latest`,
    SET_INTERVAL: `${API_BASE_URL}/set-interval`,
    DISPLAY_MODE: `${API_BASE_URL}/display-mode`,
    SENSOR_CONTROL: `${API_BASE_URL}/sensor-control`,
    RECALIBRATE: `${API_BASE_URL}/recalibrate`,
};
