import os
import joblib

scaler_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "models",
    "scaler.pkl"
)

if not os.path.isfile(scaler_path):
    print(f"Error: '{scaler_path}' not found.")
else:
    try:
        scaler = joblib.load(scaler_path)

        if hasattr(scaler, "feature_names_in_"):
            print("Feature names:")
            print(*scaler.feature_names_in_, sep="\n")
        else:
            print("Scaler has no feature_names_in_ attribute.")

    except Exception as e:
        print(f"Failed to load scaler: {e}")
