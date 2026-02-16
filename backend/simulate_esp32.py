import urllib.request
import json
import time
import random

# Use localhost if running on the same machine
url = "http://127.0.0.1:5000/predict"

print(f"Sending simulated data to {url}...")
print("Press Ctrl+C to stop.")

while True:
    try:
        data = {
            "bpm": random.randint(60, 120),
            "respiration": random.randint(12, 25),
            "spo2": random.randint(90, 100),
            "hrv": random.randint(20, 80)
        }
        
        json_data = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=json_data, headers={'Content-Type': 'application/json'})
        
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                resp_body = response.read().decode('utf-8')
                resp_json = json.loads(resp_body)
                print(f"Sent: BPM={data['bpm']}, HRV={data['hrv']} -> Response: {resp_json.get('stress', 'Unknown')}")
            else:
                print(f"Failed: {response.status}")
                
    except Exception as e:
        print(f"Error: {e}")
        print("Ensure the server.py is running!")
    
    time.sleep(2)
