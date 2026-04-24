import urllib.request
import json
import time

url = "https://stress-monitoring-system-using-ppg-sensor.onrender.com/predict"

test_cases = [
    {
        "name": "Low Stress (Relaxed)",
        "data": {"bpm": 65, "hrv": 80, "spo2": 99, "respiration": 12}
    },
    {
        "name": "Normal State",
        "data": {"bpm": 75, "hrv": 50, "spo2": 98, "respiration": 16}
    },
    {
        "name": "High Stress (Anxiety)",
        "data": {"bpm": 110, "hrv": 15, "spo2": 96, "respiration": 24}
    },
    {
        "name": "Invalid State (No Finger)",
        "data": {"bpm": 0, "hrv": 0, "spo2": 0, "respiration": 0}
    }
]

print(f"{'Test Case':<25} | {'BPM':<5} | {'HRV':<5} | {'SpO2':<5} | {'Stress Prediction':<15} | {'Warning Message'}")
print("-" * 100)

for case in test_cases:
    try:
        json_data = json.dumps(case["data"]).encode('utf-8')
        req = urllib.request.Request(url, data=json_data, headers={'Content-Type': 'application/json'})
        
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status == 200:
                resp_body = response.read().decode('utf-8')
                res = json.loads(resp_body)
                
                bpm = case["data"]["bpm"]
                hrv = case["data"]["hrv"]
                spo2 = case["data"]["spo2"]
                stress = res.get("stress", "N/A")
                warning = res.get("warning", "N/A")
                print(f"{case['name']:<25} | {bpm:<5} | {hrv:<5} | {spo2:<5} | {stress:<15} | {warning}")
            else:
                print(f"{case['name']:<25} | FAILED (Status {response.status})")
    except Exception as e:
        print(f"{case['name']:<25} | ERROR: {str(e)}")

print("\nAll test cases completed on Render Cloud.")
