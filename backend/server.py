from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import pandas as pd
import os
import time
import sys
import threading
import numpy as np

import firebase_admin
from firebase_admin import credentials, db

# ============================================================
#  PATHS
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_model_path(filename):
    return os.path.join(BASE_DIR, "models", filename)

# ============================================================
#  LOAD MODELS
# ============================================================
print("=" * 50)
print("  Stress Monitor Backend — Starting")
print("=" * 50)
print("\nLoading models...")
try:
    rf_model      = joblib.load(get_model_path("rf_model.pkl"))
    xgb_model     = joblib.load(get_model_path("xgb_model.pkl"))
    scaler        = joblib.load(get_model_path("scaler.pkl"))
    label_encoder = joblib.load(get_model_path("label_encoder.pkl"))
    print("  ✓ rf_model.pkl")
    print("  ✓ xgb_model.pkl")
    print("  ✓ scaler.pkl")
    print("  ✓ label_encoder.pkl")
    print(f"  ✓ Classes : {label_encoder.classes_}")
    print("Models loaded successfully.\n")
except Exception as e:
    print(f"Error loading models: {e}")
    sys.exit(1)

# ============================================================
#  INITIALIZE FIREBASE
# ============================================================
cred_path = os.path.join(BASE_DIR, "firebase_credentials.json")
if not os.path.exists(cred_path):
    print("=" * 55)
    print("ERROR: firebase_credentials.json not found!")
    print("Firebase Console → Project Settings → Service Accounts")
    print("→ Generate New Private Key → save as firebase_credentials.json")
    print("=" * 55)
    sys.exit(1)

try:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://stressmonitor-ec062-default-rtdb.asia-southeast1.firebasedatabase.app'
    })
    print("✓ Firebase initialized successfully.")
    print("  Listening on /stressPPG/sensor_data ...\n")
except Exception as e:
    print(f"Failed to initialize Firebase: {e}")
    sys.exit(1)

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Prediction mode: 'ml' (model-based) or 'rule' (threshold-based)
prediction_mode = "ml"

# In-memory latest result for API
latest_result = {
    "status"    : "waiting",
    "stress"    : None,
    "warning"   : None,
    "confidence": None,
    "features"  : None,
    "push_key"  : None,
    "timestamp" : None
}

# ============================================================
#  PROCESS SENSOR DATA (Firebase Listener)
#  Called automatically whenever new data is pushed to
#  /stressPPG/sensor_data by the ESP32
# ============================================================
def process_sensor_data(event):
    global latest_result

    raw = event.data

    # Skip null or non-dict events
    if not isinstance(raw, dict):
        return

    print(f"\n[{time.strftime('%H:%M:%S')}] Event received from Firebase")

    # ── Handle push() structure ──────────────────────────────
    # When ESP32 uses pushJSON(), Firebase sends data as:
    # { "-OFkABC123": { "bpm": 75, "rmssd": 42.3, ... } }
    # We extract the latest (last) pushed entry.
    first_value = list(raw.values())[0] if raw else None

    if isinstance(first_value, dict):
        # push() structure — get the most recently added key
        push_key = list(raw.keys())[-1]
        data     = raw[push_key]
        print(f"  Push key : {push_key}")
    else:
        # flat structure (direct set) — use as-is
        push_key = None
        data     = raw

    if not isinstance(data, dict):
        print("  Skipping — unexpected data format")
        return

    # ── Skip if already processed ────────────────────────────
    status = data.get("status", "")
    if status == "done":
        print(f"  Already processed (status=done) — skipping")
        return

    # ── Extract HRV features ─────────────────────────────────
    bpm   = data.get("bpm",   0)
    rmssd = float(data.get("rmssd", data.get("hrv", 0)))
    sdnn  = float(data.get("sdnn",  0))
    pnn50 = float(data.get("pnn50", 0))
    lf_hf = float(data.get("lf_hf", 0))
    spo2  = data.get("spo2",  98)
    resp  = data.get("resp",  16)

    print(f"  [DEBUG] Raw features -> BPM:{bpm}, RMSSD:{rmssd}, SDNN:{sdnn}, pNN50:{pnn50}, LF/HF:{lf_hf}")

    # ── Handle idle / invalid BPM ────────────────────────────
    if bpm == 0 or bpm < 40 or bpm > 200:
        print("  → Invalid BPM (0 or out of range) — marking Idle")
        write_prediction_latest("Idle", "Place finger on sensor",
                                bpm, rmssd, spo2, resp, None)
        mark_entry_done(push_key)
        latest_result = {
            "status"    : "idle",
            "stress"    : "Idle",
            "warning"   : "Place finger on sensor",
            "confidence": None,
            "features"  : None,
            "push_key"  : push_key,
            "timestamp" : int(time.time())
        }
        return

    # ── Cap RMSSD ────────────────────────────────────────────
    rmssd = min(rmssd, 200.0)

    # ── Choose prediction pipeline ───────────────────────────
    if prediction_mode == "rule":
        # ── RULE-BASED (threshold) prediction ────────────────
        stress_label, confidence = rule_based_predict(bpm, rmssd, sdnn, pnn50, lf_hf)
        print(f"\n  [RULE-BASED] --> {stress_label}  ({confidence}% confidence)")
    else:
        # ── ML MODEL prediction (ensemble RF + XGB) ──────────
        feature_names = ["RMSSD", "SDRR", "pNN50", "LF_HF"]
        X = pd.DataFrame(
            [[rmssd, sdnn, pnn50, lf_hf]],
            columns=feature_names
        )

        try:
            X_scaled = scaler.transform(X)
        except Exception as e:
            print(f"  Scaler error: {e}")
            return

        try:
            # Use only XGB model (disable RF for testing)
            xgb_pred_enc = xgb_model.predict(X_scaled)[0]
            xgb_proba    = xgb_model.predict_proba(X_scaled)[0]

            # Use XGB directly
            final_enc    = xgb_pred_enc
            confidence   = round(float(np.max(xgb_proba)) * 100, 2)

            stress_label = label_encoder.inverse_transform([final_enc])[0]

            print(f"\n  XGB --> {stress_label}  ({confidence}% confidence)")

        except Exception as e:
            print(f"  Prediction error: {e}")
            return

    # ── Warning message ───────────────────────────────────────
    warning = get_warning(stress_label)

    # ── Write latest prediction to /stressPPG/prediction ─────
    # Uses set() so ESP32 always reads the most recent result
    write_prediction_latest(stress_label, warning,
                            bpm, rmssd, spo2, resp, confidence)

    # ── Also push prediction history (no overwrite) ───────────
    push_prediction_history(stress_label, warning, confidence,
                            bpm, rmssd, sdnn, pnn50, lf_hf, spo2, resp)

    # ── Mark sensor entry as done ─────────────────────────────
    mark_entry_done(push_key)

    # ── Update in-memory state ────────────────────────────────
    latest_result = {
        "status"    : "success",
        "stress"    : stress_label,
        "warning"   : warning,
        "confidence": confidence,
        "features"  : {
            "rmssd": rmssd, "sdnn": sdnn,
            "pnn50": pnn50, "lf_hf": lf_hf,
            "bpm"  : bpm,   "spo2": spo2, "resp": resp
        },
        "push_key"  : push_key,
        "timestamp" : int(time.time())
    }

    print(f"\n{'='*45}")
    print(f"  RESULT     : {stress_label}")
    print(f"  WARNING    : {warning}")
    print(f"  CONFIDENCE : {confidence}%")
    print(f"{'='*45}\n")

# ============================================================
#  RULE-BASED PREDICTION (no ML models)
#  Uses HRV thresholds derived from clinical literature
# ============================================================
def rule_based_predict(bpm, rmssd, sdnn, pnn50, lf_hf):
    """
    Score-based stress classification using HRV parameters.
    Each parameter contributes a stress score; total determines label.
    """
    score = 0

    # BPM scoring
    if bpm > 100:   score += 3
    elif bpm > 90:  score += 2
    elif bpm > 80:  score += 1
    elif bpm < 55:  score += 1   # bradycardia is also abnormal

    # RMSSD scoring (lower = more stress)
    if rmssd < 8:    score += 3
    elif rmssd < 12:  score += 2
    elif rmssd < 16:  score += 1

    # SDNN scoring (lower = more stress)
    if sdnn < 40:    score += 3
    elif sdnn < 80:  score += 2
    elif sdnn < 120: score += 1

    # pNN50 scoring (lower = more stress; training uses 0-3 ratio)
    if pnn50 < 0.2:   score += 2
    elif pnn50 < 0.5:  score += 1

    # LF/HF scoring (higher = more sympathetic = more stress)
    if lf_hf > 300:   score += 3
    elif lf_hf > 150:  score += 2
    elif lf_hf > 80:   score += 1

    # Classify based on total score (max possible ~14)
    if score >= 8:
        label = "time pressure"
        conf  = min(60 + score * 3, 95)
    elif score >= 5:
        label = "interruption"
        conf  = min(50 + score * 3, 85)
    else:
        label = "no stress"
        conf  = min(60 + (10 - score) * 3, 95)

    print(f"  [RULE] Score={score}/14  BPM={bpm} RMSSD={rmssd} SDNN={sdnn} pNN50={pnn50} LF/HF={lf_hf}")
    return label, round(conf, 2)

# ============================================================
#  HELPER — warning messages
# ============================================================
def get_warning(label):
    return {
        "time pressure": "High Stress: Time pressure detected",
        "interruption" : "Elevated Stress: Frequent interruptions",
        "no stress"    : "Normal / Calm state",
        "stress"       : "Moderate Stress",
        "low"          : "Low Stress (Relaxed)",
        "normal"       : "Normal / Calm state"
    }.get(label.lower(), "Normal")

# ============================================================
#  WRITE LATEST PREDICTION (set — ESP32 reads from here)
#  /stressPPG/prediction  ← always latest, overwritten
# ============================================================
def write_prediction_latest(stress, warning, bpm, hrv,
                             spo2, resp, confidence):
    ref = db.reference('/stressPPG/prediction')
    try:
        ref.set({
            "stress"      : stress,
            "warning"     : warning,
            "bpm"         : bpm,
            "hrv"         : hrv,
            "spo2"        : spo2,
            "respiration" : resp,
            "confidence"  : confidence,
            "last_updated": time.time()
        })
        print("  ✓ Latest prediction written → /stressPPG/prediction")
    except Exception as e:
        print(f"  ✗ Failed to write latest prediction: {e}")

# ============================================================
#  PUSH PREDICTION HISTORY (push — never overwrites)
#  /stressPPG/prediction_history/-OFkXXX/ ← full history
# ============================================================
def push_prediction_history(stress, warning, confidence,
                             bpm, rmssd, sdnn, pnn50, lf_hf, spo2, resp):
    ref = db.reference('/stressPPG/prediction_history')
    try:
        ref.push({
            "stress"     : stress,
            "warning"    : warning,
            "confidence" : confidence,
            "bpm"        : bpm,
            "rmssd"      : rmssd,
            "sdnn"       : sdnn,
            "pnn50"      : pnn50,
            "lf_hf"      : lf_hf,
            "spo2"       : spo2,
            "resp"       : resp,
            "timestamp"  : time.time()
        })
        print("  ✓ History pushed → /stressPPG/prediction_history")
    except Exception as e:
        print(f"  ✗ Failed to push history: {e}")

# ============================================================
#  MARK SENSOR ENTRY AS DONE
#  Updates status field of the specific pushed entry
# ============================================================
def mark_entry_done(push_key):
    if not push_key:
        return
    try:
        db.reference(f'/stressPPG/sensor_data/{push_key}/status').set("done")
        print(f"  ✓ Entry {push_key} marked as done")
    except Exception as e:
        print(f"  ✗ Failed to mark done: {e}")

# ============================================================
#  FLASK API ENDPOINTS
# ============================================================

@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "server"          : "running",
        "prediction_mode" : prediction_mode,
        "classes"         : list(label_encoder.classes_),
        "time"            : time.strftime('%H:%M:%S')
    })

@app.route("/prediction-mode", methods=["POST"])
def set_prediction_mode():
    global prediction_mode
    data = request.json
    mode = data.get("mode", "").lower()
    if mode in ("ml", "rule"):
        prediction_mode = mode
        db.reference('/stressPPG/config/prediction_mode').set(mode)
        print(f"\n  >> Prediction mode changed to: {mode.upper()}")
        return jsonify({"status": "success", "mode": mode})
    return jsonify({"error": "Invalid mode. Use 'ml' or 'rule'."}), 400

@app.route("/prediction-mode", methods=["GET"])
def get_prediction_mode():
    return jsonify({"mode": prediction_mode})

@app.route("/prediction", methods=["GET"])
@app.route("/latest", methods=["GET"])
def get_prediction():
    # Fetch config from Firebase to include in response
    config_ref = db.reference('/stressPPG/config')
    config = config_ref.get() or {}

    # Merge latest_result with server-side metadata and config
    response = latest_result.copy()
    response.update({
        "server_now"        : int(time.time()),
        "last_updated"      : latest_result.get("timestamp", 0),
        "display_mode"      : config.get("display_mode"),
        "is_sensor_active"  : config.get("is_sensor_active"),
        "send_interval"     : config.get("send_interval")
    })
    return jsonify(response)

@app.route("/display-mode", methods=["POST"])
def set_display_mode():
    data = request.json
    mode = data.get("mode")
    if mode:
        db.reference('/stressPPG/config/display_mode').set(mode)
        return jsonify({"status": "success", "mode": mode})
    return jsonify({"error": "No mode provided"}), 400

@app.route("/sensor-control", methods=["POST"])
def set_sensor_control():
    data = request.json
    active = data.get("active")
    if active is not None:
        db.reference('/stressPPG/config/is_sensor_active').set(active)
        return jsonify({"status": "success", "active": active})
    return jsonify({"error": "No status provided"}), 400

@app.route("/set-interval", methods=["POST"])
def set_interval():
    data = request.json
    interval = data.get("interval")
    if interval:
        db.reference('/stressPPG/config/send_interval').set(interval)
        return jsonify({"status": "success", "interval": interval})
    return jsonify({"error": "No interval provided"}), 400

@app.route("/recalibrate", methods=["POST"])
def recalibrate():
    db.reference('/stressPPG/config/recalibrate').set(True)
    # Reset it shortly after or let the ESP32 reset it
    return jsonify({"status": "success", "message": "Recalibration triggered"})

@app.route("/sensor", methods=["GET"])
def get_sensor():
    ref  = db.reference('/stressPPG/sensor_data')
    data = ref.get()
    return jsonify(data if data else {"error": "No data found"})

@app.route("/history", methods=["GET"])
def get_history():
    ref  = db.reference('/stressPPG/prediction_history')
    data = ref.get()
    return jsonify(data if data else {"error": "No history found"})

# ============================================================
#  SETUP FIREBASE LISTENER
# ============================================================
try:
    sensor_ref = db.reference('/stressPPG/sensor_data')
    sensor_ref.listen(process_sensor_data)
    print("✓ Firebase listener active on /stressPPG/sensor_data\n")
except Exception as e:
    print(f"Failed to setup Firebase listener: {e}")
    sys.exit(1)

# ============================================================
#  MAIN
# ============================================================
if __name__ == "__main__":
    # Flask in background thread so Firebase listener runs on main thread
    flask_thread = threading.Thread(
        target=lambda: app.run(host="0.0.0.0", port=5000, debug=False),
        daemon=True
    )
    flask_thread.start()
    print("✓ Flask API running on http://0.0.0.0:5000\n")

    try:
        print("Backend is running (Press Ctrl+C to stop)...")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServer shutting down gracefully.")
        sys.exit(0)
