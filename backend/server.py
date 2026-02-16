
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os
import time

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

rf_model = joblib.load("models/rf_model.pkl")
xgb_model = joblib.load("models/xgb_model.pkl")
scaler = joblib.load("models/scaler.pkl")
label_encoder = joblib.load("models/label_encoder.pkl")
current_display_mode = "STRESS"
is_sensor_active = True
send_interval = 10000  # Default 10 seconds
recalibrate_flag = False

# Initial state: last_updated is 0 (never connected)
latest_reading = {
    "stress": "Idle",
    "warning": "Place finger on sensor",
    "bpm": 0,
    "hrv": 0,
    "spo2": 0,
    "respiration": 0,
    "display_mode": current_display_mode,
    "is_sensor_active": is_sensor_active,
    "send_interval": send_interval,
    "last_updated": 0
}

@app.route("/predict", methods=["POST"])
def predict():
    global latest_reading, current_display_mode, recalibrate_flag
    data = request.json

    bpm = data.get("bpm", 0)
    resp = data.get("respiration", 16)
    spo2 = data.get("spo2", 98)
    hrv = data.get("hrv", 0)

    # Handle Idle / No Finger State
    if bpm == 0:
        latest_reading = {
            "stress": "Idle",
            "warning": "Place finger on sensor",
            "bpm": 0,
            "hrv": 0,
            "spo2": 0,
            "respiration": 0,
            "display_mode": current_display_mode,
            "is_sensor_active": is_sensor_active,
            "send_interval": send_interval,
            "recalibrate": recalibrate_flag,
            "last_updated": time.time()
        }
        recalibrate_flag = False # Reset after sending to device
        return jsonify(latest_reading)

    # Sanity check for realistic biometric data
    if bpm < 40 or bpm > 200:
        latest_reading = {
            "stress": "Invalid",
            "warning": "Please keep still and retry",
            "bpm": bpm,
            "hrv": hrv,
            "spo2": spo2,
            "respiration": resp,
            "display_mode": current_display_mode,
            "is_sensor_active": is_sensor_active,
            "send_interval": send_interval,
            "recalibrate": recalibrate_flag,
            "last_updated": time.time(),
            "server_now": time.time()
        }
        recalibrate_flag = False # Reset after sending to device
        return jsonify(latest_reading)

    # Final safety cap for HRV (RMSSD) based on user-provided unrealistic thresholds
    if hrv > 200:
        hrv = 200

    # Simple logic (replace with your actual model logic if needed)
    stress_index = bpm / hrv if hrv != 0 else 0
    spo2_dev = 100 - spo2

    X = np.array([[bpm, resp, spo2, hrv, stress_index, spo2_dev]])
    X = scaler.transform(X)

    rf_pred = rf_model.predict(X)
    xgb_pred = xgb_model.predict(X)

    final_pred = int(round((rf_pred[0] + xgb_pred[0]) / 2))
    
    # Check if label_encoder has inverse_transform, otherwise map manually/safely
    try:
        stress_label = label_encoder.inverse_transform([final_pred])[0]
    except:
        stress_label = str(final_pred)

    warning = "Normal"
    if stress_label == "High":
        warning = "Take rest and breathe slowly"
    elif stress_label == "Low":
        warning = "Relaxed state"

    # Update global latest_reading
    latest_reading = {
        "stress": stress_label,
        "warning": warning,
        "bpm": bpm,
        "hrv": hrv,
        "spo2": spo2,
        "respiration": resp,
        "display_mode": current_display_mode,
        "is_sensor_active": is_sensor_active,
        "send_interval": send_interval,
        "recalibrate": recalibrate_flag,
        "last_updated": time.time()  # Current server time
    }
    recalibrate_flag = False # Reset after sending to device

    return jsonify(latest_reading)

@app.route("/set-interval", methods=["POST"])
def set_interval():
    global send_interval, latest_reading
    data = request.json
    if "interval" in data:
        send_interval = int(data["interval"])
        latest_reading["send_interval"] = send_interval
    return jsonify({"status": "success", "interval": send_interval})

@app.route("/sensor-control", methods=["POST"])
def set_sensor_control():
    global is_sensor_active, latest_reading
    data = request.json
    if "active" in data:
        is_sensor_active = bool(data["active"])
        latest_reading["is_sensor_active"] = is_sensor_active
        # Optionally, we could also reset sensor data if stopping
        if not is_sensor_active:
             latest_reading["bpm"] = 0
             latest_reading["hrv"] = 0
    return jsonify({"status": "success", "is_sensor_active": is_sensor_active})

@app.route("/display-mode", methods=["POST"])
def set_display_mode():
    global current_display_mode, latest_reading
    data = request.json
    if "mode" in data:
        current_display_mode = data["mode"]
        # Update latest_reading immediately so /latest also reflects it
        latest_reading["display_mode"] = current_display_mode
    return jsonify({"status": "success", "mode": current_display_mode})

@app.route("/recalibrate", methods=["POST"])
def recalibrate():
    global recalibrate_flag
    recalibrate_flag = True
    return jsonify({"status": "success", "message": "Recalibration triggered"})

@app.route("/latest", methods=["GET"])
def get_latest():
    # Return latest reading but include current server time for heartbeat sync
    return jsonify({**latest_reading, "server_now": time.time()})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
