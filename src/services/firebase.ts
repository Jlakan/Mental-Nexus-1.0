import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


// --- PEGA TUS CREDENCIALES REALES DE NUEVO AQUÍ ---
const firebaseConfig = {
 apiKey: "AIzaSyBPWPg9vkkXFuzdbc2icnHUz4_epjUUO9s",
 authDomain: "mental-nexus-ac4c6.firebaseapp.com",
 projectId: "mental-nexus-ac4c6",
 storageBucket: "mental-nexus-ac4c6.firebasestorage.app",
 messagingSenderId: "455120917108",
 appId: "1:455120917108:web:d7bc3df9f75c4ad204f721"
};


const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
