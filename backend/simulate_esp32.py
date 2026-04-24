import firebase_admin
from firebase_admin import credentials, db
import time
import random
import os

# Initialize Firebase Admin
cred_path = os.path.join(os.path.dirname(__file__), 'firebase_credentials.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://stressmonitor-ec062-default-rtdb.asia-southeast1.firebasedatabase.app'
    })

print("🔥 Simulation started. Pushing data to /stressPPG/sensor_data ...")
print("Press Ctrl+C to stop.")

# Target node
ref = db.reference('/stressPPG/sensor_data')

def simulate():
    try:
        for i in range(5):
            # Simulate HRV-like data
            data = {
                "bpm": random.randint(70, 95),
                "rmssd": round(random.uniform(20.0, 60.0), 2),
                "sdnn": round(random.uniform(30.0, 70.0), 2),
                "pnn50": round(random.uniform(10.0, 40.0), 2),
                "lf_hf": round(random.uniform(0.5, 3.0), 2),
                "status": "Written"
            }
            
            ref.set(data)
            print(f"[{i+1}/5] ✅ Sent Proxy Data: BPM={data['bpm']}, RMSSD={data['rmssd']}")
            
            time.sleep(20)  # Faster for initial test
            
    except KeyboardInterrupt:
        print("\nStopping simulation...")

if __name__ == "__main__":
    simulate()
