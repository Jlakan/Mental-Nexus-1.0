// src/services/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ AQUÍ PEGA TUS PROPIAS CREDENCIALES DE FIREBASE ⚠️
const firebaseConfig = {
    apiKey: "AIzaSyBPWPg9vkkXFuzdbc2icnHUz4_epjUUO9s",
    authDomain: "mental-nexus-ac4c6.firebaseapp.com",
    projectId: "mental-nexus-ac4c6",
    storageBucket: "mental-nexus-ac4c6.firebasestorage.app",
    messagingSenderId: "455120917108",
    appId: "1:455120917108:web:d7bc3df9f75c4ad204f721"
   };
   

// 1. Inicializamos la app
const app = initializeApp(firebaseConfig);

// 2. EXPORTAMOS las herramientas (¡Esto es lo que faltaba!)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();