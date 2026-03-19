import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp as firestoreServerTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7ETR2uLN49e-qfhB4Td9nJcJWHfzmu-E",
  authDomain: "ep-projectb.firebaseapp.com",
  projectId: "ep-projectb",
  storageBucket: "ep-projectb.firebasestorage.app",
  messagingSenderId: "246216582684",
  appId: "1:246216582684:web:8e016e5819ea8492e9e1d9",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbInstance: any = null;

try {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  dbInstance = getFirestore(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("CRITICAL: Firebase initialization failed:", error);
  dbInstance = null;
}

export const db = dbInstance;
export { collection, addDoc };
export const serverTimestamp = firestoreServerTimestamp;
