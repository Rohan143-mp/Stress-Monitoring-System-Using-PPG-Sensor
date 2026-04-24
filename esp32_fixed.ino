// ============================================================
//  ML-Based Stress Monitoring Using PPG
//  ESP32 + MAX30102 + HRV + Firebase + OLED
//  TUNED to actual signal: IR~22k-24k, range~3700
//  Fixed: DC removal + robust adaptive threshold
// ============================================================

#include <Wire.h>
#include <WiFi.h>
#include <math.h>

#include "MAX30105.h"

#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ============================================================
//  CREDENTIALS
// ============================================================
#define WIFI_SSID       "RHN"
#define WIFI_PASSWORD   "Rohan123"
#define DATABASE_URL    "https://stressmonitor-ec062-default-rtdb.asia-southeast1.firebasedatabase.app"
#define API_KEY         "AIzaSyC9XOEjnmRv8rrI1-H_Gl-ns5hW-_V5lH0"
#define AUTH_EMAIL      "pednekarrohan43@gmail.com"
#define AUTH_PASSWORD   "Rohan123@"

// ============================================================
//  TIMING
// ============================================================
#define UPLOAD_INTERVAL_MS   30000
#define OLED_UPDATE_MS       500

// ============================================================
//  OLED
// ============================================================
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
#define OLED_RESET     -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ============================================================
//  MAX30102
// ============================================================
MAX30105 particleSensor;

// ============================================================
//  SENSOR SETTINGS
// ============================================================
#define LED_BRIGHTNESS  0x0A
#define SAMPLE_RATE     400

// ============================================================
//  FINGER DETECTION
// ============================================================
#define FINGER_ON_THRESHOLD   5000
#define FINGER_OFF_THRESHOLD  3000

// ============================================================
//  PEAK DETECTION — tuned to 400Hz
// ============================================================
#define PEAK_THRESHOLD_PCT    0.02f   // 2% of AC signal range
#define PEAK_THRESHOLD_MIN    15.0f   // absolute minimum slope
#define PEAK_THRESHOLD_MAX    200.0f  // absolute maximum slope
#define PEAK_MIN_INTERVAL_MS  333     // min 333ms between beats = max 180 BPM

// ============================================================
//  HRV
// ============================================================
#define MAX_RR_SAMPLES   120
#define MIN_RR_MS        333
#define MAX_RR_MS        1500
#define MIN_RR_FOR_HRV   10
#define MEDIAN_WINDOW    3

// ============================================================
//  FIREBASE
// ============================================================
FirebaseData   fbdo;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;
bool           firebaseReady = false;
String         latestPushKey = "";

// ============================================================
//  PEAK DETECTION STATE
// ============================================================
float         prev1        = 0;
float         prev2        = 0;
unsigned long lastPeakTime = 0;
float         adaptThr     = PEAK_THRESHOLD_MIN;

// DC removal state
float         irDC         = 0;
const float   DC_ALPHA     = 0.05f;

// Smooth buffer
#define SMOOTH_SIZE  4
float         smoothBuf[SMOOTH_SIZE];
int           smoothIdx   = 0;
float         smoothSum   = 0.0;
bool          smoothReady = false;

// ============================================================
//  HRV BUFFERS
// ============================================================
float         rawRR[MAX_RR_SAMPLES + MEDIAN_WINDOW];
int           rawRRCount  = 0;
float         rrIntervals[MAX_RR_SAMPLES];
int           rrCount     = 0;

// Filter state for SpO2
#define MA_WINDOW  8
float         maBuffer[MA_WINDOW];
int           maIndex     = 0;
float         maSum2      = 0.0;
bool          maFilled    = false;
float         lpFiltered  = 0.0;
bool          lpInit      = false;
#define       LP_ALPHA    0.10f

float         maRedBuf[MA_WINDOW];
int           maRedIdx    = 0;
float         maRedSum    = 0.0;
bool          maRedFill   = false;
float         lpRed       = 0.0;

// SpO2 accumulators
#define SPO2_INTERVAL  200
float spo2 = 0; bool spo2Valid = false;
float sRA=0,sIA=0,sRD=0,sID=0; int spCnt=0;
float rDC=0,iDC=0; float dcA=0.005;

// Beat state
unsigned long lastBeat      = 0;
bool          fingerOn      = false;
int           beatAvg       = 0;
const byte    RATE_SIZE     = 4;
byte          rates[RATE_SIZE];
byte          rateSpot      = 0;

// Window timer
unsigned long windowStart   = 0;
bool          windowActive  = false;

// Timers
unsigned long lastOled      = 0;
unsigned long lastDiag      = 0;

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found"); while(true);
  }
  displayMessage("Booting...", "");
  delay(500);

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not found");
    displayMessage("Sensor Error!", "Check wiring");
    while(true);
  }

  particleSensor.setup(LED_BRIGHTNESS, 1, 2, SAMPLE_RATE, 411, 4096);
  particleSensor.setPulseAmplitudeGreen(0);
  Serial.printf("MAX30102 ready | LED=0x%02X | SR=%d\n", LED_BRIGHTNESS, SAMPLE_RATE);
  displayMessage("Sensor OK", "Place finger...");
  delay(500);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  displayMessage("Connecting", "Wi-Fi...");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nIP: " + WiFi.localIP().toString());
  displayMessage("Wi-Fi OK", WiFi.localIP().toString().c_str());
  delay(500);

  fbConfig.api_key               = API_KEY;
  fbConfig.database_url          = DATABASE_URL;
  fbAuth.user.email              = AUTH_EMAIL;
  fbAuth.user.password           = AUTH_PASSWORD;
  fbConfig.token_status_callback = tokenStatusCallback;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  displayMessage("Firebase", "Connecting...");
  int t = 0;
  while (!Firebase.ready() && t < 20) { delay(1000); t++; }
  if (Firebase.ready()) {
    firebaseReady = true;
    Firebase.RTDB.setString(&fbdo, "/stressPPG/status", "ESP32 Connected");
    Serial.println("Firebase ready");
    displayMessage("Firebase OK", "Place finger...");
  } else {
    Serial.println("Firebase timeout");
    displayMessage("Firebase FAIL", "");
  }
  delay(500);

  lastBeat = millis();
}

// ============================================================
//  SIGNAL PROCESSING HELPERS
// ============================================================
float smoothSignal(float v) {
  smoothSum          -= smoothBuf[smoothIdx];
  smoothBuf[smoothIdx] = v;
  smoothSum          += v;
  smoothIdx           = (smoothIdx + 1) % SMOOTH_SIZE;
  if (smoothIdx == 0) smoothReady = true;
  return smoothSum / (smoothReady ? SMOOTH_SIZE : (smoothIdx == 0 ? SMOOTH_SIZE : smoothIdx));
}

float removeDC(float raw) {
  if (irDC == 0) irDC = raw;
  irDC = (raw * DC_ALPHA) + (irDC * (1.0f - DC_ALPHA));
  return raw - irDC;
}

// ============================================================
//  PEAK DETECTION
// ============================================================
bool detectPeak(float currentAC) {
  // Slope between prev1 and prev2 (sA) and current and prev1 (sB)
  float sA = prev1 - prev2;
  float sB = currentAC - prev1;
  bool found = false;

  // Signal must be rising sharply (sA > threshold) then start falling (sB < 0)
  if (sA > adaptThr && sB < 0 &&
      (millis() - lastPeakTime) > PEAK_MIN_INTERVAL_MS) {
    found       = true;
    lastPeakTime = millis();
  }

  // Update adaptive threshold from local AC signal range
  static float localMax = -9999, localMin = 9999;
  static unsigned long lastRangeUpdate = 0;
  
  if (currentAC > localMax) localMax = currentAC;
  if (currentAC < localMin) localMin = currentAC;

  // Refresh range tracking every 2 seconds
  if (millis() - lastRangeUpdate > 2000) {
    float range = localMax - localMin;
    if (range > 50) {
      adaptThr = range * PEAK_THRESHOLD_PCT;
      adaptThr = constrain(adaptThr, PEAK_THRESHOLD_MIN, PEAK_THRESHOLD_MAX);
    }
    localMax = -9999; localMin = 9999;
    lastRangeUpdate = millis();
  }

  prev2 = prev1;
  prev1 = currentAC;
  return found;
}

// ============================================================
//  MAIN LOOP
// ============================================================
void loop() {
  particleSensor.check();
  long ir  = particleSensor.getIR();
  long red = particleSensor.getRed();

  // ── Diagnostic every 3s ──────────────────────────────────
  if (millis() - lastDiag > 3000) {
    Serial.printf("[Diag] IR:%-7ld  Thr:%-5.1f  RR:%-3d  BPM:%d\n",
                  ir, adaptThr, rrCount, beatAvg);
    lastDiag = millis();
  }

  // ── Finger detection ──────────────────────────────────────
  if (ir < FINGER_OFF_THRESHOLD) {
    if (fingerOn) {
      fingerOn = false; windowActive = false;
      resetAll(); Serial.println("Finger removed");
    }
    if (millis() - lastOled > OLED_UPDATE_MS) {
      displayMessage("No Finger", "Place finger...");
      lastOled = millis();
    }
    return;
  }

  if (!fingerOn && ir > FINGER_ON_THRESHOLD) {
    fingerOn = true; windowActive = true; windowStart = millis();
    resetAll();
    Serial.printf("\nFinger ON (IR=%ld) — 30s window started\n", ir);
    displayMessage("Finger OK", "Sensing 30s...");
    lastOled = millis();
  }

  // ── Signal Filtering ─────────────────────────────────────
  long fIR  = applyIRFilter(ir);
  long fRed = applyRedFilter(red);
  calcSpO2(red, ir, fRed, fIR);

  // Peak detection on DC-removed signal
  float acIR = removeDC(smoothSignal((float)ir));

  if (detectPeak(acIR)) {
    unsigned long now   = millis();
    long          delta = now - lastBeat;
    lastBeat            = now;

    if (delta >= MIN_RR_MS && delta <= MAX_RR_MS) {
      float bpm = 60000.0f / delta;
      if (bpm >= 40 && bpm <= 180) {
        rates[rateSpot++] = (byte)min((int)bpm, 255);
        rateSpot         %= RATE_SIZE;
        beatAvg           = 0;
        for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
        beatAvg          /= RATE_SIZE;

        if (rawRRCount < MAX_RR_SAMPLES + MEDIAN_WINDOW)
          rawRR[rawRRCount++] = (float)delta;

        if (rawRRCount >= MEDIAN_WINDOW) {
          float medRR = medianFilter(rawRR, rawRRCount);
          if (rrCount < MAX_RR_SAMPLES) {
            rrIntervals[rrCount++] = medRR;
            Serial.printf("[RR %d/%d] %.0fms | BPM:%d | Thr:%.1f\n",
                          rrCount, MIN_RR_FOR_HRV, medRR, beatAvg, adaptThr);
          }
        }
      }
    }
  }

  // ── OLED countdown ────────────────────────────────────────
  if (windowActive && millis() - lastOled > OLED_UPDATE_MS) {
    int secsLeft = max(0,(int)((UPLOAD_INTERVAL_MS-(millis()-windowStart))/1000));
    char line2[24];
    sprintf(line2, "BPM:%d T-%ds", beatAvg, secsLeft);
    displayMessage("Sensing PPG", line2);
    lastOled = millis();
  }

  // ── 30s window complete ───────────────────────────────────
  if (windowActive && (millis()-windowStart) >= UPLOAD_INTERVAL_MS) {
    windowActive = false;
    Serial.printf("\n── 30s completed | RR Count: %d ──\n", rrCount);

    if (rrCount < MIN_RR_FOR_HRV) {
      displayMessage("Few beats", "Keep still...");
      delay(2000);
      resetAll(); windowActive = true; windowStart = millis();
      return;
    }

    displayMessage("Processing", "Please wait");
    int valid = iqrFilter(rrIntervals, rrCount);
    if (valid < MIN_RR_FOR_HRV) {
      displayMessage("Low Quality", "Restarting...");
      resetAll(); windowActive = true; windowStart = millis();
      delay(1000); return;
    }
    rrCount = valid;

    float rmssd = computeRMSSD();
    float sdnn  = computeSDNN();
    float pnn50 = computePNN50();
    float lf_hf = computeLFHF();

    if (firebaseReady) {
      uploadToFirebase(beatAvg, rmssd, sdnn, pnn50, lf_hf);
      displayMessage("Awaiting", "ML Result...");
      delay(5000);
      fetchAndDisplay();
    }
    resetAll(); windowActive = true; windowStart = millis();
    lastOled = millis();
  }
}

// ============================================================
//  HRV & CORE HELPERS
// ============================================================
void resetAll() {
  rrCount = rawRRCount = 0;
  lastBeat = millis();
  rateSpot = beatAvg = 0;
  for (byte i = 0; i < RATE_SIZE; i++) rates[i] = 0;
  prev1 = prev2 = 0;
  lastPeakTime = millis();
  irDC = 0;
  adaptThr = PEAK_THRESHOLD_MIN;
  smoothSum = 0; smoothIdx = 0; smoothReady = false;
  for (int i = 0; i < SMOOTH_SIZE; i++) smoothBuf[i] = 0;
  for (int i = 0; i < MA_WINDOW; i++) { maBuffer[i]=0; maRedBuf[i]=0; }
  maSum2=0; maRedSum=0; maIndex=0; maRedIdx=0;
  maFilled=false; maRedFill=false;
  lpFiltered=0; lpRed=0; lpInit=false;
  spo2Valid=false; rDC=0; iDC=0;
  sRA=0; sIA=0; sRD=0; sID=0; spCnt=0; spo2=0;
}

long applyIRFilter(long raw) {
  maSum2 -= maBuffer[maIndex]; maBuffer[maIndex]=(float)raw; maSum2+=maBuffer[maIndex];
  maIndex=(maIndex+1)%MA_WINDOW; if(maIndex==0)maFilled=true;
  int d=maFilled?MA_WINDOW:(maIndex==0?MA_WINDOW:maIndex);
  long ma=(long)(maSum2/d);
  if(!lpInit){lpFiltered=ma;lpInit=true;}
  lpFiltered=LP_ALPHA*ma+(1.0f-LP_ALPHA)*lpFiltered;
  return (long)lpFiltered;
}

long applyRedFilter(long raw) {
  maRedSum-=maRedBuf[maRedIdx]; maRedBuf[maRedIdx]=(float)raw; maRedSum+=maRedBuf[maRedIdx];
  maRedIdx=(maRedIdx+1)%MA_WINDOW; if(maRedIdx==0)maRedFill=true;
  int d=maRedFill?MA_WINDOW:(maRedIdx==0?MA_WINDOW:maRedIdx);
  long ma=(long)(maRedSum/d);
  lpRed=LP_ALPHA*ma+(1.0f-LP_ALPHA)*lpRed;
  return (long)lpRed;
}

void calcSpO2(long rR,long rI,long fR,long fI){
  if(rDC==0){rDC=rR;iDC=rI;}
  rDC+=dcA*(rR-rDC); iDC+=dcA*(rI-iDC);
  sRA+=abs(fR-rDC); sIA+=abs(fI-iDC);
  sRD+=rDC; sID+=iDC; spCnt++;
  if(spCnt>=SPO2_INTERVAL){
    float aRA=sRA/spCnt,aIA=sIA/spCnt,aRD=sRD/spCnt,aID=sID/spCnt;
    if(aRD>0&&aID>0&&aIA>0){
      float R=(aRA/aRD)/(aIA/aID),s=110.0-25.0*R;
      if(s>=85&&s<=100){spo2=spo2*0.7+s*0.3;spo2Valid=true;}
    }
    sRA=sIA=sRD=sID=0; spCnt=0;
  }
}

float medianFilter(float* buf, int count) {
  float w[MEDIAN_WINDOW];
  int s=count-MEDIAN_WINDOW;
  for(int i=0;i<MEDIAN_WINDOW;i++) w[i]=buf[s+i];
  for(int i=0;i<MEDIAN_WINDOW-1;i++)
    for(int j=0;j<MEDIAN_WINDOW-1-i;j++)
      if(w[j]>w[j+1]){float t=w[j];w[j]=w[j+1];w[j+1]=t;}
  return w[MEDIAN_WINDOW/2];
}

int iqrFilter(float* rr, int count) {
  float s[MAX_RR_SAMPLES];
  for(int i=0;i<count;i++) s[i]=rr[i];
  for(int i=0;i<count-1;i++)
    for(int j=0;j<count-1-i;j++)
      if(s[j]>s[j+1]){float t=s[j];s[j]=s[j+1];s[j+1]=t;}
  float q1=s[count/4],q3=s[3*count/4],iqr=q3-q1;
  float lo=q1-1.5f*iqr,hi=q3+1.5f*iqr;
  int v=0;
  for(int i=0;i<count;i++) if(rr[i]>=lo&&rr[i]<=hi) rr[v++]=rr[i];
  return v;
}

float computeRMSSD(){
  float s=0;int n=rrCount-1;
  for(int i=0;i<n;i++){float d=rrIntervals[i+1]-rrIntervals[i];s+=d*d;}
  return n>0?sqrt(s/n):0;
}
float computeSDNN(){
  float sum=0;for(int i=0;i<rrCount;i++)sum+=rrIntervals[i];
  float m=sum/rrCount,s=0;
  for(int i=0;i<rrCount;i++){float d=rrIntervals[i]-m;s+=d*d;}
  return sqrt(s/rrCount);
}
float computePNN50(){
  int c=0,tot=rrCount-1;
  for(int i=0;i<tot;i++)if(fabs(rrIntervals[i+1]-rrIntervals[i])>50)c++;
  return tot>0?(float)c/tot*100:0;
}
float computeLFHF(){
  float sum=0;for(int i=0;i<rrCount;i++)sum+=rrIntervals[i];
  float fs=1000.0/(sum/rrCount),lf=0,hf=0;
  for(int k=1;k<rrCount/2;k++){
    float freq=(float)k*fs/rrCount,re=0,im=0;
    for(int n=0;n<rrCount;n++){
      float a=2.0*PI*k*n/rrCount;
      re+=rrIntervals[n]*cos(a);im-=rrIntervals[n]*sin(a);
    }
    float p=(re*re+im*im)/((float)rrCount*rrCount);
    if(freq>=0.04&&freq<0.15)lf+=p;
    if(freq>=0.15&&freq<0.40)hf+=p;
  }
  return hf==0?0:lf/hf;
}

void uploadToFirebase(int bpm,float rmssd,float sdnn,float pnn50,float lf_hf){
  FirebaseJson json;
  json.set("bpm",bpm); json.set("rmssd",rmssd); json.set("sdnn",sdnn);
  json.set("pnn50",pnn50); json.set("lf_hf",lf_hf);
  json.set("spo2",spo2Valid?(int)spo2:0);
  json.set("status","pending"); json.set("timestamp",(int)(millis()/1000));
  if(Firebase.RTDB.pushJSON(&fbdo,"/stressPPG/sensor_data",&json)){
    latestPushKey=fbdo.pushName(); Serial.println("Upload OK: "+latestPushKey);
  } else {
    Serial.println("Upload FAIL: "+fbdo.errorReason());
  }
}

void fetchAndDisplay(){
  if(Firebase.RTDB.getString(&fbdo,"/stressPPG/prediction/stress")){
    String r=fbdo.stringData();
    if(r=="High")        displayMessage("!! STRESSED !!","Take a break");
    else if(r=="Low")    displayMessage("RELAXED",       "You are calm");
    else if(r=="Normal") displayMessage("NORMAL",        "Optimal");
    else                 displayMessage("Result:",r.c_str());
  }
  delay(5000);
}

void displayMessage(const char* l1,const char* l2){
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);display.setCursor(0,8);display.println(l1);
  display.setTextSize(2);display.setCursor(0,30);display.println(l2);
  display.display();
}
