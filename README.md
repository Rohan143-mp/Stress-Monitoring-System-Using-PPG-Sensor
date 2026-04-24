# AI-Powered Stress Monitoring System (ESP32 + ML)

A real-time stress monitoring and analysis system using ESP32, MAX30105 sensor, and Machine Learning. The system captures biometric data (BPM, HRV) and predicts stress levels using a Random Forest & XGBoost model.

## 🚀 Tech Stack

- **Hardware**: ESP32 (Microcontroller), MAX30105 (Pulse Oximeter/Heart-Rate Sensor), SSD1306 (OLED Display).
- **Backend**: Python Flask, Scikit-Learn (Random Forest), XGBoost, Joblib.
- **Frontend**: React Native (Expo), React Navigation, React Native SVG (Real-time Graph).
- **Communication**: HTTP/JSON over WiFi.

## 🛠️ Hardware Requirements

| Component | Description |
| :--- | :--- |
| **ESP32 DevKit V1** | Main microcontroller with WiFi/Bluetooth. |
| **MAX30105 / MAX30102** | High-sensitivity pulse oximetry and heart-rate sensor. |
| **SSD1306 OLED (128x64)** | I2C display for real-time local feedback. |
| **Jumper Wires** | Female-to-Female or Male-to-Female. |
| **Breadboard** | For easy wiring. |

### Wiring Diagram (I2C)
- **VCC** -> 3.3V (ESP32)
- **GND** -> GND (ESP32)
- **SDA** -> GPIO 21 (ESP32)
- **SCL** -> GPIO 22 (ESP32)

## 📦 Installation Guide

### 1. ESP32 Setup
- Open `esp32` code in Arduino IDE.
- Install libraries: `SparkFun_MAX3010x`, `Adafruit_SSD1306`, `ArduinoJson`.
- Update `ssid`, `password`, and `serverURL` (your local IP) in the code.
- Upload to ESP32.

### 2. Backend Setup
```bash
cd backend
pip install flask joblib numpy scikit-learn xgboost
python server.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npx expo start
```

## 🌟 Advantages

1. **Non-Invasive**: Real-time monitoring via simple finger placement.
2. **Hybrid ML Approach**: Uses both Random Forest and XGBoost for higher prediction accuracy.
3. **Low Latency**: Optimized ESP32 sampling and Flask API for near-instant feedback.
4. **Interactive Dashboard**: Real-time line graphs to visualize BPM trends.
5. **Dynamic Control**: Change measurement intervals (10s/20s/30s) directly from the app.

## 🔮 Future Scope

- **Cloud Integration**: Store data in MongoDB/Firebase for long-term health tracking.
- **Stress Alerts**: Push notifications when high stress levels are detected for a prolonged period.
- **Biofeedback Workouts**: Integrated breathing exercises that adjust based on live HRV readings.
- **Wearable Form Factor**: Designing a custom 3D-printed enclosure for a wrist-worn version.
- **Multi-Sensor Fusion**: Adding GSR (Galvanic Skin Response) for even more accurate stress detection.
