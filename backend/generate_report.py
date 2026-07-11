import json
import urllib.request

URL = "https://stress-monitoring-system-using-ppg-sensor.onrender.com/predict"

TEST_CASES = [
    ("Low Stress (Relaxed)", {"bpm": 65, "hrv": 80, "spo2": 99, "respiration": 12}),
    ("Normal State", {"bpm": 75, "hrv": 50, "spo2": 98, "respiration": 16}),
    ("High Stress (Anxiety)", {"bpm": 110, "hrv": 15, "spo2": 96, "respiration": 24}),
    ("Idle / No Finger", {"bpm": 0, "hrv": 0, "spo2": 0, "respiration": 0}),
]

report = [
    "# Stress Prediction Verification Report (Render Cloud)\n",
    "| Test Case | BPM | HRV | SpO2 | Stress Result | Warning Message |",
    "| :--- | :--- | :--- | :--- | :--- | :--- |",
]

for name, data in TEST_CASES:
    try:
        req = urllib.request.Request(
            URL,
            data=json.dumps(data).encode(),
            headers={"Content-Type": "application/json"},
        )

        with urllib.request.urlopen(req, timeout=15) as response:
            res = json.load(response)

        report.append(
            f"| {name} | {data['bpm']} | {data['hrv']} | {data['spo2']} | "
            f"**{res.get('stress', 'N/A')}** | {res.get('warning', 'N/A')} |"
        )

    except Exception as e:
        report.append(f"| {name} | - | - | - | Error | {e} |")

with open("test_report.md", "w", encoding="utf-8") as f:
    f.write("\n".join(report))

print("✅ Report generated: test_report.md")
