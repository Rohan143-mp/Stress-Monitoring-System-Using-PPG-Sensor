import firebase_admin
from firebase_admin import credentials, db
import time, os, random

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(BASE_DIR, "firebase_credentials.json")

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://stressmonitor-ec062-default-rtdb.asia-southeast1.firebasedatabase.app'
    })

sensor_ref = db.reference('/stressPPG/sensor_data')

print("=" * 55)
print("  Pushing 10 RANDOM sensor data entries to Firebase")
print("=" * 55)

for i in range(10):
    data = {
        "bpm": random.randint(60, 110),
        "rmssd": round(random.uniform(5.0, 30.0), 2),
        "sdnn": round(random.uniform(20.0, 150.0), 2),
        "pnn50": round(random.uniform(0.1, 2.0), 2),
        "lf_hf": round(random.uniform(0.1, 500.0), 2),
        "spo2": random.randint(94, 99),
        "resp": random.randint(12, 24),
        "timestamp": time.time()
    }
    
    print(f"[{i+1}/10] Pushing: BPM={data['bpm']}, RMSSD={data['rmssd']}, LF/HF={data['lf_hf']:.1f}")
    sensor_ref.push(data)
    time.sleep(2) # Push every 2 seconds

print("\nDone! All random inputs pushed.")
print("=" * 55)
