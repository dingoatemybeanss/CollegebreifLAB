import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyANpGUNgnmrXG4_Mznma2syL0H-ygzA0TQ",
  authDomain: "college-breif.firebaseapp.com",
  projectId: "college-breif",
  storageBucket: "college-breif.firebasestorage.app",
  messagingSenderId: "909905457319",
  appId: "1:909905457319:web:f1e0290af971e2799d2b82",
  measurementId: "G-RM84VBESQ5",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
