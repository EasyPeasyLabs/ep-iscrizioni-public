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

// Initialize Firebase
// Use compat syntax: firebase.initializeApp
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Initialize Firestore
export const db = app.firestore();
export const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
