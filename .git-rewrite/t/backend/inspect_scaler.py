import joblib
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Check backend/models subdirectory
scaler_path = os.path.join(BASE_DIR, "models", "scaler.pkl")

try:
    if not os.path.exists(scaler_path):
        print(f"Error: {scaler_path} not found.")
    else:
        scaler = joblib.load(scaler_path)
        if hasattr(scaler, 'feature_names_in_'):
            print("Feature names seen at fit time:")
            for name in scaler.feature_names_in_:
                print(f"- {name}")
        else:
            print("Scaler does not have feature_names_in_ attribute.")
except Exception as e:
    print(f"Error: {e}")
