import urllib.request
import json

url = "https://stress-monitoring-system-using-ppg-sensor.onrender.com/predict"

test_cases = [
    {"name": "Low Stress (Relaxed)", "data": {"bpm": 65, "hrv": 80, "spo2": 99, "respiration": 12}},
    {"name": "Normal State", "data": {"bpm": 75, "hrv": 50, "spo2": 98, "respiration": 16}},
    {"name": "High Stress (Anxiety)", "data": {"bpm": 110, "hrv": 15, "spo2": 96, "respiration": 24}},
    {"name": "Idle / No Finger", "data": {"bpm": 0, "hrv": 0, "spo2": 0, "respiration": 0}}
]

report = "# Stress Prediction Verification Report (Render Cloud)\n\n"
report += "| Test Case | BPM | HRV | SpO2 | Stress Result | Warning Message |\n"
report += "| :--- | :--- | :--- | :--- | :--- | :--- |\n"

for case in test_cases:
    try:
        json_data = json.dumps(case["data"]).encode('utf-8')
        req = urllib.request.Request(url, data=json_data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=15) as response:
            res = json.loads(response.read().decode('utf-8'))
            report += f"| {case['name']} | {case['data']['bpm']} | {case['data']['hrv']} | {case['data']['spo2']} | **{res.get('stress')}** | {res.get('warning')} |\n"
    except Exception as e:
        report += f"| {case['name']} | error | error | error | error | {str(e)} |\n"

with open('test_report.md', 'w') as f:
    f.write(report)
print("Report generated: test_report.md")
