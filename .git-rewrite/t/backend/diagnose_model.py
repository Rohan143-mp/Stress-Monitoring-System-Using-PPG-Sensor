"""
Diagnose why ML model always predicts 'interruption'
"""
import joblib
import pandas as pd
import numpy as np
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
rf_model      = joblib.load(os.path.join(BASE_DIR, "models", "rf_model.pkl"))
xgb_model     = joblib.load(os.path.join(BASE_DIR, "models", "xgb_model.pkl"))
scaler        = joblib.load(os.path.join(BASE_DIR, "models", "scaler.pkl"))
label_encoder = joblib.load(os.path.join(BASE_DIR, "models", "label_encoder.pkl"))

print("Classes:", label_encoder.classes_)
print("Scaler mean:", scaler.mean_)
print("Scaler scale:", scaler.scale_)
print("Feature names expected:", ["RMSSD", "SDRR", "pNN50", "LF_HF"])
print()

# Test cases covering different stress scenarios
test_cases = [
    {"label": "RELAXED",       "rmssd": 55.2, "sdnn": 48.3, "pnn50": 22.1, "lf_hf": 0.8},
    {"label": "NORMAL",        "rmssd": 42.0, "sdnn": 38.5, "pnn50": 15.3, "lf_hf": 1.2},
    {"label": "MILD STRESS",   "rmssd": 28.5, "sdnn": 25.0, "pnn50": 8.7,  "lf_hf": 2.1},
    {"label": "TIME PRESSURE", "rmssd": 18.3, "sdnn": 15.2, "pnn50": 4.2,  "lf_hf": 3.5},
    {"label": "HIGH STRESS",   "rmssd": 12.1, "sdnn": 10.8, "pnn50": 2.1,  "lf_hf": 3.9},
]

# Also test with values near the scaler mean (training data center)
print("="*60)
print("Testing with values near scaler training center:")
mean_test = scaler.mean_
print(f"  Scaler means: RMSSD={mean_test[0]:.2f}, SDRR={mean_test[1]:.2f}, pNN50={mean_test[2]:.2f}, LF_HF={mean_test[3]:.2f}")
print()

for tc in test_cases:
    label = tc["label"]
    feature_names = ["RMSSD", "SDRR", "pNN50", "LF_HF"]
    X = pd.DataFrame([[tc["rmssd"], tc["sdnn"], tc["pnn50"], tc["lf_hf"]]], columns=feature_names)
    X_scaled = scaler.transform(X)
    
    rf_proba  = rf_model.predict_proba(X_scaled)[0]
    xgb_proba = xgb_model.predict_proba(X_scaled)[0]
    avg_proba = (rf_proba + xgb_proba) / 2
    
    final_enc = int(np.argmax(avg_proba))
    pred_label = label_encoder.inverse_transform([final_enc])[0]
    conf = round(float(np.max(avg_proba)) * 100, 2)
    
    print(f"[{label}]")
    print(f"  Raw:    RMSSD={tc['rmssd']}, SDNN={tc['sdnn']}, pNN50={tc['pnn50']}, LF/HF={tc['lf_hf']}")
    print(f"  Scaled: {X_scaled[0]}")
    print(f"  RF  probs: {dict(zip(label_encoder.classes_, rf_proba.round(3)))}")
    print(f"  XGB probs: {dict(zip(label_encoder.classes_, xgb_proba.round(3)))}")
    print(f"  Avg probs: {dict(zip(label_encoder.classes_, avg_proba.round(3)))}")
    print(f"  → Prediction: {pred_label} ({conf}%)")
    print()

# Try extreme values to see if model can predict other classes
print("="*60)
print("Testing EXTREME values:")
extremes = [
    {"label": "All zeros",    "rmssd": 0,   "sdnn": 0,   "pnn50": 0,   "lf_hf": 0},
    {"label": "All high",     "rmssd": 200, "sdnn": 200, "pnn50": 100, "lf_hf": 10},
    {"label": "Mean values",  "rmssd": mean_test[0], "sdnn": mean_test[1], "pnn50": mean_test[2], "lf_hf": mean_test[3]},
]
for tc in extremes:
    label = tc["label"]
    X = pd.DataFrame([[tc["rmssd"], tc["sdnn"], tc["pnn50"], tc["lf_hf"]]], columns=feature_names)
    X_scaled = scaler.transform(X)
    rf_proba  = rf_model.predict_proba(X_scaled)[0]
    xgb_proba = xgb_model.predict_proba(X_scaled)[0]
    avg_proba = (rf_proba + xgb_proba) / 2
    final_enc = int(np.argmax(avg_proba))
    pred_label = label_encoder.inverse_transform([final_enc])[0]
    conf = round(float(np.max(avg_proba)) * 100, 2)
    print(f"[{label}] → {pred_label} ({conf}%) | probs: {dict(zip(label_encoder.classes_, avg_proba.round(3)))}")
