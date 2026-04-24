import joblib
import os

BASE_DIR = r"f:\Information Technology\College\SEm6\Mini\stress monitoring system\backend"
label_encoder = joblib.load(os.path.join(BASE_DIR, "models", "label_encoder.pkl"))
print(f"Classes: {label_encoder.classes_}")

scaler = joblib.load(os.path.join(BASE_DIR, "models", "scaler.pkl"))
print(f"Scaler features count: {scaler.n_features_in_}")
if hasattr(scaler, 'feature_names_in_'):
    print(f"Scaler feature names: {scaler.feature_names_in_}")
else:
    print("Scaler does not have feature names saved.")
