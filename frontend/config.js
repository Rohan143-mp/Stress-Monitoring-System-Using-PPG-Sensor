// Centralized configuration for the API URL
// Toggle between LOCAL and CLOUD mode

const USE_CLOUD = true;

const LOCAL_IP = "10.121.7.118";
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
