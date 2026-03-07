import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7ETR2uLN49e-qfhB4Td9nJcJWHfzmu-E",
  authDomain: "ep-projectb.firebaseapp.com",
  projectId: "ep-projectb",
  storageBucket: "ep-projectb.firebasestorage.app",
  messagingSenderId: "246216582684",
  appId: "1:246216582684:web:8e016e5819ea8492e9e1d9"
};

let app;
let dbInstance;
let serverTimestampInstance;

try {
  app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
  dbInstance = app.firestore();
  serverTimestampInstance = firebase.firestore.FieldValue.serverTimestamp;
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("CRITICAL: Firebase initialization failed:", error);
  dbInstance = null;
  serverTimestampInstance = () => new Date();
}

export const db = dbInstance;
export const serverTimestamp = serverTimestampInstance;
