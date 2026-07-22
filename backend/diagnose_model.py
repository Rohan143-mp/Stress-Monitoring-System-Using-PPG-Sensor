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

feature_names = ["RMSSD", "SDRR", "pNN50", "LF_HF"]

#Its just for testing ang diagnosing model


#Optimized test cases loop ..  9 july 2026
for tc in test_cases:
    X = pd.DataFrame(
        [[tc[k] for k in ("rmssd", "sdnn", "pnn50", "lf_hf")]],
        columns=feature_names
    )

    X_scaled = scaler.transform(X)

    rf_probs = rf_model.predict_proba(X_scaled)[0]
    xgb_probs = xgb_model.predict_proba(X_scaled)[0]
    avg_probs = (rf_probs + xgb_probs) / 2

    pred = label_encoder.inverse_transform([avg_probs.argmax()])[0]
    conf = avg_probs.max() * 100

    print(f"[{tc['label']}]")
    print(f"  Raw:    {tc}")
    print(f"  Scaled: {X_scaled[0]}")
    print(f"  RF :    {dict(zip(label_encoder.classes_, rf_probs.round(3)))}")
    print(f"  XGB:    {dict(zip(label_encoder.classes_, xgb_probs.round(3)))}")
    print(f"  Avg:    {dict(zip(label_encoder.classes_, avg_probs.round(3)))}")
    print(f"  → Prediction: {pred} ({conf:.2f}%)\n")

# Try extreme values to see if model can predict other classes
print("="*60)
print("Testing EXTREME values:")
extremes = [
    {"label": "All zeros",    "rmssd": 0,   "sdnn": 0,   "pnn50": 0,   "lf_hf": 0},
    {"label": "All high",     "rmssd": 200, "sdnn": 200, "pnn50": 100, "lf_hf": 10},
    {"label": "Mean values",  "rmssd": mean_test[0], "sdnn": mean_test[1], "pnn50": mean_test[2], "lf_hf": mean_test[3]},
]
\

#This version scales the data only once .   --8/jun/2026
for tc in extremes:
    X = pd.DataFrame(
        [[tc[f] for f in feature_names]],
        columns=feature_names
    )

    X_scaled = scaler.transform(X)

    probs = (
        rf_model.predict_proba(X_scaled)[0] +
        xgb_model.predict_proba(X_scaled)[0]
    ) / 2

    print(
        f"[{tc['label']}] → "
        f"{label_encoder.inverse_transform([probs.argmax()])[0]} "
        f"({probs.max() * 100:.2f}%) | "
        f"{dict(zip(label_encoder.classes_, probs.round(3)))}"
    )
