"""
Push pseudo sensor data matching ACTUAL training data ranges.
Scaler means: RMSSD=14.98, SDRR=109.35, pNN50=0.87, LF_HF=115.98
"""
import firebase_admin
from firebase_admin import credentials, db
import time, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(BASE_DIR, "firebase_credentials.json")

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://stressmonitor-ec062-default-rtdb.asia-southeast1.firebasedatabase.app'
    })

sensor_ref = db.reference('/stressPPG/sensor_data')

# Values based on ACTUAL scaler training ranges:
# RMSSD mean=14.98, scale=4.12  -> range ~5-25
# SDRR  mean=109.35, scale=77.12 -> range ~30-250
# pNN50 mean=0.87, scale=0.99  -> range ~0-3 (ratio, not %)
# LF_HF mean=115.98, scale=360.85 -> range ~0-500+ (raw power ratio)
test_cases = [
    {"label": "NO STRESS (relaxed)",
     "bpm": 72, "rmssd": 18.5, "sdnn": 160.0, "pnn50": 1.8, "lf_hf": 50.0, "spo2": 98, "resp": 14},

    {"label": "NO STRESS (calm)",
     "bpm": 68, "rmssd": 16.0, "sdnn": 140.0, "pnn50": 1.2, "lf_hf": 80.0, "spo2": 97, "resp": 15},

    {"label": "INTERRUPTION (moderate)",
     "bpm": 85, "rmssd": 12.5, "sdnn": 90.0, "pnn50": 0.5, "lf_hf": 150.0, "spo2": 96, "resp": 18},

    {"label": "TIME PRESSURE (high)",
     "bpm": 100, "rmssd": 8.0, "sdnn": 40.0, "pnn50": 0.2, "lf_hf": 400.0, "spo2": 95, "resp": 22},

    {"label": "TIME PRESSURE (extreme)",
     "bpm": 110, "rmssd": 6.0, "sdnn": 25.0, "pnn50": 0.1, "lf_hf": 600.0, "spo2": 94, "resp": 24},
]

print("=" * 55)
print("  Pushing CORRECTED pseudo data to Firebase")
print("=" * 55)

for i, tc in enumerate(test_cases):
    label = tc.pop("label")
    print(f"\n[{i+1}/{len(test_cases)}] {label}")
    print(f"  BPM:{tc['bpm']} RMSSD:{tc['rmssd']} SDNN:{tc['sdnn']} pNN50:{tc['pnn50']} LF/HF:{tc['lf_hf']}")

    sensor_ref.push(tc)
    print(f"  Pushed! Waiting 6s...")
    time.sleep(6)

print("\n" + "=" * 55)
print("  Done! Check backend + frontend.")
print("=" * 55)
