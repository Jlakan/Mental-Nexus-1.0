// src/utils/SecurityUtils.ts
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  addDoc, 
  collection, 
  serverTimestamp
  // Timestamp eliminada porque no se usa
} from "firebase/firestore";
import { db } from '../services/firebase';

// --- TIPOS DE AUDITORÍA ---
export type SecurityAction = 
  | 'access_granted'   // Se otorgó permiso con PIN
  | 'access_revoked'   // El paciente quitó el permiso
  | 'access_denied'    // Intentó entrar con PIN incorrecto
  | 'view_sensitive';  // Visualizó datos sensibles

interface LogData {
  patientId: string;
  professionalId: string;
  category: string;
  action: SecurityAction;
  details?: string;
}

// ============================================================================
// 1. SISTEMA DE AUDITORÍA (INMUTABLE)
// ============================================================================

/**
 * Registra un evento de seguridad en la colección 'audit_logs'.
 * Esta colección debe tener reglas de Firestore que impidan la edición/borrado.
 */
export const logClinicalAccess = async (data: LogData) => {
  try {
    await addDoc(collection(db, "audit_logs"), {
      ...data,
      timestamp: serverTimestamp(),
      userAgent: window.navigator.userAgent // Para rastrear dispositivo
    });
    console.log(`🔒 Security Log: ${data.action} on ${data.category}`);
  } catch (error) {
    console.error("Fallo crítico al registrar auditoría:", error);
    // En un entorno real, aquí podrías forzar un logout por seguridad
  }
};

// ============================================================================
// 2. GESTIÓN DE PIN Y VERIFICACIÓN
// ============================================================================

/**
 * Verifica si el PIN ingresado coincide con el del paciente.
 */
export const verifyPin = async (patientId: string, inputPin: string): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, "users", patientId));
    
    if (!userDoc.exists()) return false;
    
    const realPin = userDoc.data().privacyPin;
    
    // Si el usuario no tiene PIN configurado, fallamos por seguridad
    if (!realPin) return false;

    const isValid = String(realPin).trim() === String(inputPin).trim();

    if (!isValid) {
      // Registrar intento fallido
      // No pasamos profesionalId aquí porque esta función puede llamarse antes de tener contexto completo,
      // pero idealmente deberíamos pasarlo si está disponible.
      console.warn("Intento de PIN fallido");
    }

    return isValid;

  } catch (error) {
    console.error("Error verificando PIN:", error);
    return false;
  }
};

// ============================================================================
// 3. GESTIÓN DE PERMISOS (GRANT / REVOKE / CHECK)
// ============================================================================

/**
 * Otorga acceso permanente a una categoría específica para un profesional.
 * Se llama después de que verifyPin retorna true.
 */
export const grantCategoryAccess = async (
  patientId: string, 
  professionalId: string, 
  category: string
) => {
  const permissionRef = doc(db, "users", patientId, "permissions", professionalId);

  // Usamos setDoc con merge para crear el documento si no existe
  await setDoc(permissionRef, {
    professionalId,
    grantedAt: serverTimestamp(),
    categories: arrayUnion(category)
  }, { merge: true });

  // Auditoría
  await logClinicalAccess({
    patientId,
    professionalId,
    category,
    action: 'access_granted',
    details: 'Acceso autorizado mediante PIN'
  });
};

/**
 * Revoca el acceso a una categoría.
 * (Función para el botón "Revocar" del Dashboard de Paciente)
 */
export const revokeCategoryAccess = async (
  patientId: string, 
  professionalId: string, 
  category: string
) => {
  const permissionRef = doc(db, "users", patientId, "permissions", professionalId);

  await updateDoc(permissionRef, {
    categories: arrayRemove(category)
  });

  // Auditoría
  await logClinicalAccess({
    patientId,
    professionalId,
    category,
    action: 'access_revoked',
    details: 'Revocación manual por el usuario'
  });
};

/**
 * Verifica si un profesional tiene permiso para ver una categoría.
 * Se usa para renderizar el candado 🔒 o el contenido.
 */
export const checkPermission = async (
  patientId: string, 
  professionalId: string, 
  category: string
): Promise<boolean> => {
  try {
    const permissionRef = doc(db, "users", patientId, "permissions", professionalId);
    const snap = await getDoc(permissionRef);

    if (!snap.exists()) return false;

    const data = snap.data();
    const allowedCategories: string[] = data.categories || [];

    // Retorna true si tiene la categoría específica O acceso global (si existiera esa feature)
    return allowedCategories.includes(category) || allowedCategories.includes('GLOBAL');

  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
};