import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// IMPORTANT: Replace the placeholders with your actual Firebase project config
// You can find these in Firebase Console -> Project Settings -> General -> Web App
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "stressmonitor-ec062.firebaseapp.com",
  databaseURL: "https://stressmonitor-ec062-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "stressmonitor-ec062",
  storageBucket: "stressmonitor-ec062.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };
