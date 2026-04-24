import joblib
import pandas as pd
import numpy as np
import os

BASE_DIR = r"f:\Information Technology\College\SEm6\Mini\stress monitoring system\backend"
xgb_model = joblib.load(os.path.join(BASE_DIR, "models", "xgb_model.pkl"))
scaler = joblib.load(os.path.join(BASE_DIR, "models", "scaler.pkl"))
label_encoder = joblib.load(os.path.join(BASE_DIR, "models", "label_encoder.pkl"))

# User's data
# BPM:78, RMSSD:145.30869, SDNN:153.54599, pNN50:50.0, LF/HF:4.30698
data = {
    "RMSSD": 145.30869,
    "SDRR": 153.54599,
    "pNN50": 50.0,
    "LF_HF": 4.30698
}

X = pd.DataFrame([data])
X_scaled = scaler.transform(X)
xgb_proba = xgb_model.predict_proba(X_scaled)[0]
final_enc = np.argmax(xgb_proba)
stress_label = label_encoder.inverse_transform([final_enc])[0]
confidence = round(float(np.max(xgb_proba)) * 100, 2)

print(f"Prediction for user data: {stress_label} ({confidence}%)")
print(f"Probabilities: {dict(zip(label_encoder.classes_, xgb_proba))}")
