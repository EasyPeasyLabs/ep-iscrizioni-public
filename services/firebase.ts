import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuration for 'ep-projectb' as requested
// Environment variables are preferred, but defaults align with the specific request
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "demo-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "ep-projectb.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "ep-projectb",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "ep-projectb.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "246216582684",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:246216582684:web:placeholder"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);