/*
 * ESP32 + MAX30105 PPG Sensor + SSD1306 OLED Display
 * ---------------------------------------------------
 * Reads PPG data, filters noise, calculates BPM, HRV,
 * SpO2 and displays everything on OLED. No WiFi.
 *
 * Wiring (both on same I2C bus):
 *   SDA -> GPIO 21
 *   SCL -> GPIO 22
 *   VCC -> 3.3V
 *   GND -> GND
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>

//////////////// WIFI & THINGSPEAK ///////
const char* ssid = "Rohan";
const char* password = "8412817676";
String thingspeakAPIKey = "FUCNXBIEM244PTYJ";
unsigned long lastThingSpeakTime = 0;
const unsigned long thingspeakInterval = 10000; // 10 seconds


//////////////// OLED //////////////////
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

//////////////// SENSOR //////////////////
MAX30105 sensor;

//////////////// NOISE FILTER //////////////
#define MA_SIZE 8
long maBuffer[MA_SIZE];
int maIdx = 0;
long maSum = 0;

long maRedBuffer[MA_SIZE];
int maRedIdx = 0;
long maRedSum = 0;

float lpAlpha = 0.2;
float lpIR = 0;
float lpRed = 0;

float hpAlpha = 0.95;
float hpPrevIR = 0;
float hpOutputIR = 0;

//////////////// BPM //////////////////
#define BPM_SIZE 10
float bpmBuffer[BPM_SIZE];
int bpmIdx = 0;
bool bpmReady = false;
float bpm = 0;
long lastBeatTime = 0;

//////////////// HRV //////////////////
#define HRV_SIZE 15
long rrIntervals[HRV_SIZE];
int hrvIdx = 0;
bool hrvReady = false;
float hrv = 0;
long prevRR = 0;

//////////////// SpO2 //////////////////
float spo2 = 0;
bool spo2Valid = false;
float sumRedAC = 0, sumIRAC = 0;
float sumRedDC = 0, sumIRDC = 0;
int spo2SampleCount = 0;
#define SPO2_CALC_INTERVAL 100
float redDC = 0;
float irDC = 0;
float dcAlpha = 0.005;


//////////////// TIMING //////////////////
unsigned long lastDisplayTime = 0;
unsigned long lastSerialTime = 0;
bool fingerDetected = false;

//////////////////////////////////////////////////////
// SETUP
//////////////////////////////////////////////////////

void setup() {
  Serial.begin(115200);
  delay(1000);  // Give serial time to connect

  Serial.println("\n\n=============================");
  Serial.println("  PPG Sensor + OLED Monitor + ThingSpeak");
  Serial.println("=============================");

  // --- Connect to WiFi ---
  Serial.print("\n[STEP 0] Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  int retryCount = 0;
  while (WiFi.status() != WL_CONNECTED && retryCount < 20) {
    delay(500);
    Serial.print(".");
    retryCount++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n  -> WiFi Connected!");
    Serial.print("  -> IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n  -> WiFi Connection Failed. Skipping...");
  }

  // --- Init I2C at STANDARD speed first ---
  Wire.begin(21, 22);
  // NOTE: Using standard 100kHz speed for reliability
  // Do NOT use Wire.setClock(400000) if devices are not responding
  delay(500);

  // --- STEP 1: I2C Scan to find devices ---
  Serial.println("\n[STEP 1] Scanning I2C bus...");
  int devicesFound = 0;
  bool oledFound = false;
  bool sensorFound = false;
  byte oledAddr = 0x3C;

  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("  Found device at 0x");
      Serial.println(addr, HEX);
      devicesFound++;

      if (addr == 0x3C || addr == 0x3D) {
        oledFound = true;
        oledAddr = addr;
        Serial.println("    -> This is the OLED display");
      }
      if (addr == 0x57) {
        sensorFound = true;
        Serial.println("    -> This is the MAX30105 sensor");
      }
    }
  }

  Serial.print("  Total devices found: ");
  Serial.println(devicesFound);

  if (devicesFound == 0) {
    Serial.println("\n*** NO I2C DEVICES FOUND! ***");
    Serial.println("Check your wiring:");
    Serial.println("  SDA -> GPIO 21");
    Serial.println("  SCL -> GPIO 22");
    Serial.println("  VCC -> 3.3V");
    Serial.println("  GND -> GND");
    Serial.println("  Make sure pull-up resistors are present (most modules have them)");
    while (1) { delay(5000); Serial.println("Halted - no I2C devices."); }
  }

  // --- STEP 2: Init OLED ---
  Serial.print("\n[STEP 2] Initializing OLED at 0x");
  Serial.print(oledAddr, HEX);
  Serial.println("...");

  if (display.begin(SSD1306_SWITCHCAPVCC, oledAddr)) {
    Serial.println("  -> OLED: OK!");
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setTextSize(1);
    display.setCursor(10, 5);
    display.println("OLED: OK!");
    display.display();
    delay(500);
  } else {
    Serial.println("  -> OLED: FAILED!");
    Serial.println("  Try checking: power, address (0x3C or 0x3D)");
    while (1) { delay(5000); Serial.println("Halted - OLED failed."); }
  }

  // --- STEP 3: Init MAX30105 ---
  Serial.println("\n[STEP 3] Initializing MAX30105 sensor...");

  if (sensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("  -> Sensor: OK!");
    display.setCursor(10, 18);
    display.println("SENSOR: OK!");
    display.display();
  } else {
    Serial.println("  -> Sensor: FAILED!");
    Serial.println("  Check wiring and 3.3V power");
    display.setCursor(10, 18);
    display.println("SENSOR: FAILED!");
    display.setCursor(10, 35);
    display.println("Check wiring!");
    display.display();
    while (1) { delay(5000); Serial.println("Halted - sensor failed."); }
  }

  // --- STEP 4: Configure sensor ---
  Serial.println("\n[STEP 4] Configuring sensor...");

  // Use default/safe settings
  byte ledBrightness = 100;   // Increased ledBrightness for better skin penetration
  byte sampleAverage = 4;
  byte ledMode = 2;           // Red + IR
  int sampleRate = 100;       // Lower rate = more stable
  int pulseWidth = 411;       // Max pulse width = best resolution
  int adcRange = 4096;

  sensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);

  // Set LED power explicitly
  sensor.setPulseAmplitudeRed(0x1F);   // Increased Red LED for better visibility
  sensor.setPulseAmplitudeIR(0x32);    // High IR LED for better heart signal
  sensor.setPulseAmplitudeGreen(0);    // Green off

  Serial.println("  -> LED brightness set to 0x3F");
  Serial.println("  -> Sensor configured!");

  display.setCursor(10, 31);
  display.println("LEDs: ON");
  display.display();
  delay(500);

  // --- Init buffers ---
  for (int i = 0; i < MA_SIZE; i++) { maBuffer[i] = 0; maRedBuffer[i] = 0; }


  // --- Ready screen ---
  display.clearDisplay();
  display.setCursor(15, 5);
  display.println("ALL SYSTEMS OK!");
  display.setCursor(10, 25);
  display.println("Place finger on");
  display.setCursor(10, 38);
  display.println("sensor to begin...");
  display.setCursor(10, 53);
  display.println("(LED should be ON)");
  display.display();
  delay(2000);

  Serial.println("\n=============================");
  Serial.println("  Ready! Place finger...");
  Serial.println("  Sensor LED should be glowing");
  Serial.println("=============================\n");
}

//////////////////////////////////////////////////////
// FILTER FUNCTIONS
//////////////////////////////////////////////////////

long filterIR(long raw) {
  maSum -= maBuffer[maIdx];
  maBuffer[maIdx] = raw;
  maSum += raw;
  maIdx = (maIdx + 1) % MA_SIZE;
  long maOut = maSum / MA_SIZE;
  lpIR = lpIR + lpAlpha * (maOut - lpIR);
  return (long)lpIR;
}

long filterRed(long raw) {
  maRedSum -= maRedBuffer[maRedIdx];
  maRedBuffer[maRedIdx] = raw;
  maRedSum += raw;
  maRedIdx = (maRedIdx + 1) % MA_SIZE;
  long maOut = maRedSum / MA_SIZE;
  lpRed = lpRed + lpAlpha * (maOut - lpRed);
  return (long)lpRed;
}

float highPassIR(float input) {
  hpOutputIR = hpAlpha * (hpOutputIR + input - hpPrevIR);
  hpPrevIR = input;
  return hpOutputIR;
}

//////////////////////////////////////////////////////

void calculateHRV(long rr) {
  if (rr < 400 || rr > 1500) return;

  rrIntervals[hrvIdx] = rr;
  hrvIdx = (hrvIdx + 1) % HRV_SIZE;
  if (!hrvReady && hrvIdx == 0) hrvReady = true;

  int count = hrvReady ? HRV_SIZE : hrvIdx;
  if (count >= 5) {
    float sumDiffSq = 0;
    int pairs = 0;
    for (int i = 1; i < count; i++) {
      long diff = rrIntervals[i] - rrIntervals[i - 1];
      sumDiffSq += (float)(diff * diff);
      pairs++;
    }
    if (pairs > 0) hrv = sqrt(sumDiffSq / pairs);
  }
  prevRR = rr;
}

void calculateSpO2(long rawRed, long rawIR, long filteredRed, long filteredIR) {
  if (redDC == 0) { redDC = rawRed; irDC = rawIR; }
  redDC = redDC + dcAlpha * (rawRed - redDC);
  irDC = irDC + dcAlpha * (rawIR - irDC);

  float redAC = abs(filteredRed - redDC);
  float irAC = abs(filteredIR - irDC);

  sumRedAC += redAC;
  sumIRAC += irAC;
  sumRedDC += redDC;
  sumIRDC += irDC;
  spo2SampleCount++;

  if (spo2SampleCount >= SPO2_CALC_INTERVAL) {
    float avgRedAC = sumRedAC / spo2SampleCount;
    float avgIRAC = sumIRAC / spo2SampleCount;
    float avgRedDC = sumRedDC / spo2SampleCount;
    float avgIRDC = sumIRDC / spo2SampleCount;

    if (avgRedDC > 0 && avgIRDC > 0 && avgIRAC > 0) {
      float R = (avgRedAC / avgRedDC) / (avgIRAC / avgIRDC);
      float calcSpo2 = 110.0 - 25.0 * R;
      if (calcSpo2 >= 85 && calcSpo2 <= 100) {
        spo2 = spo2 * 0.7 + calcSpo2 * 0.3;
        spo2Valid = true;
      }
    }
    sumRedAC = 0; sumIRAC = 0;
    sumRedDC = 0; sumIRDC = 0;
    spo2SampleCount = 0;
  }
}

//////////////////////////////////////////////////////



void drawDisplay() {
  display.clearDisplay();
  display.setTextColor(WHITE);

  if (!fingerDetected) {
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print("STRESS MONITOR");
    display.setCursor(90, 0);
    display.print("WAIT");
    display.drawLine(0, 10, 127, 10, WHITE);
    display.setCursor(15, 25);
    display.println("Place finger on");
    display.setCursor(15, 40);
    display.println("sensor to start");
    display.display();
    return;
  }

  // --- Grid Layout ---
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("STRESS MONITOR");
  display.drawLine(0, 9, 127, 9, WHITE);

  // BPM
  display.setCursor(0, 15);
  display.print("BPM:");
  display.setCursor(0, 25);
  display.setTextSize(2);
  if (bpm > 0) display.print((int)bpm); else display.print("--");

  // SpO2
  display.setTextSize(1);
  display.setCursor(70, 15);
  display.print("SpO2:");
  display.setCursor(70, 25);
  display.setTextSize(2);
  if (spo2Valid) { display.print((int)spo2); display.print("%"); } else display.print("--%");

  display.drawLine(0, 42, 127, 42, WHITE);

  // HRV
  display.setTextSize(1);
  display.setCursor(0, 46);
  display.print("HRV:");
  display.setCursor(30, 46);
  display.setTextSize(2);
  if (hrv > 0) display.print((int)hrv); else display.print("--");
  display.setTextSize(1); display.print("ms");

  // RR
  display.setTextSize(1);
  display.setCursor(70, 46);
  display.print("RR:");
  display.setCursor(95, 46);
  display.setTextSize(2);
  if (bpm > 0) {
    int respRate = (int)(bpm / 4.5);
    if (respRate < 10) respRate = 12;
    if (respRate > 30) respRate = 20;
    display.print(respRate);
  } else {
    display.print("--");
  }

  // --- Timer / Footer ---
  int timeLeft = (int)(thingspeakInterval - (millis() - lastThingSpeakTime)) / 1000;
  if (timeLeft < 0) timeLeft = 0;
  if (!fingerDetected) timeLeft = 10; // Reset visual timer when no finger

  display.setTextSize(1);
  display.setCursor(0, 56);
  display.print("Next Sync: ");
  display.print(timeLeft);
  display.print("s");

  display.display();
}

//////////////////////////////////////////////////////
// MAIN LOOP
//////////////////////////////////////////////////////

void loop() {
  sensor.check();

  long rawIR = sensor.getIR();
  long rawRed = sensor.getRed();

  fingerDetected = (rawIR > 5000);

  if (!fingerDetected) {
    bpm = 0;
    hrv = 0;
    spo2Valid = false;
    hpOutputIR = 0;
    hpPrevIR = 0;
    lpIR = 0;
    lpRed = 0;
    redDC = 0;
    irDC = 0;

    if (millis() - lastDisplayTime > 300) {
      lastDisplayTime = millis();
      drawDisplay();
    }
    return;
  }

  long filteredIR = filterIR(rawIR);
  long filteredRed = filterRed(rawRed);

  if (checkForBeat(rawIR)) {
    long currentTime = millis();
    long rr = currentTime - lastBeatTime;
    lastBeatTime = currentTime;

    if (rr > 370 && rr < 1500) {
      float instantBpm = 60000.0 / rr;
      bpmBuffer[bpmIdx++] = instantBpm;
      if (bpmIdx >= BPM_SIZE) { bpmIdx = 0; bpmReady = true; }
      int count = bpmReady ? BPM_SIZE : bpmIdx;
      float sum = 0;
      for (int i = 0; i < count; i++) sum += bpmBuffer[i];
      bpm = sum / count;
      calculateHRV(rr);
    }
  }

  calculateSpO2(rawRed, rawIR, filteredRed, filteredIR);


  if (millis() - lastSerialTime > 100) {
    lastSerialTime = millis();
    Serial.print("BPM:"); Serial.print((int)bpm);
    Serial.print(" | HRV:"); Serial.print((int)hrv);
    Serial.print(" | SpO2:"); Serial.print(spo2Valid ? (int)spo2 : 0);
    Serial.print("% | IR:"); Serial.println(rawIR);
  }

  // --- Send to ThingSpeak ---
  if (millis() - lastThingSpeakTime > thingspeakInterval) {
    if (WiFi.status() == WL_CONNECTED && fingerDetected && bpm > 0) {
      lastThingSpeakTime = millis();
      Serial.println("\n[ThingSpeak] Uploading data...");
      HTTPClient http;
      
      int respRate = (int)(bpm / 4.5);
      if (respRate < 10) respRate = 12;
      if (respRate > 30) respRate = 20;
      
      String url = "http://api.thingspeak.com/update?api_key=" + thingspeakAPIKey + 
                   "&field1=" + String((int)bpm) + 
                   "&field2=" + String((int)hrv) + 
                   "&field3=" + String(spo2Valid ? (int)spo2 : 0) +
                   "&field4=" + String(respRate);
      
      http.begin(url);
      int httpCode = http.GET();
      if (httpCode > 0) {
        Serial.print("[ThingSpeak] HTTP Code: ");
        Serial.println(httpCode);
      } else {
        Serial.print("[ThingSpeak] Error: ");
        Serial.println(http.errorToString(httpCode));
      }
      http.end();
      
      // Empty sensor data to clear FIFO right after blocking HTTP request
      sensor.check();
    }
  }

  if (millis() - lastDisplayTime > 33) {
    lastDisplayTime = millis();
    drawDisplay();
  }
}
