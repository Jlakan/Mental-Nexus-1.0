// Ruta: src/components/professional/LinkRequestsManager.tsx

import  { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../services/firebase'; // Ajusta la ruta si es necesario

interface LinkRequest {
  patientId: string;
  patientName: string;
  professionType: string;
  status: string;
  requestedAt: string;
}

export default function LinkRequestsManager() {
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const profId = auth.currentUser.uid;

    const requestsRef = collection(
      db,
      'professionals',
      profId,
      'link_requests'
    );

    // Escucha en tiempo real la subcolección
    const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
      const pendingRequests: LinkRequest[] = [];
      snapshot.forEach((doc) => {
        pendingRequests.push(doc.data() as LinkRequest);
      });
      setRequests(pendingRequests);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResolveRequest = async (
    patientId: string,
    patientName: string,
    resolution: 'active' | 'rejected'
  ) => {
    if (
      !window.confirm(
        `¿Estás seguro de ${
          resolution === 'active' ? 'aceptar' : 'rechazar'
        } a ${patientName}?`
      )
    )
      return;

    if (!auth.currentUser) return;
    const profId = auth.currentUser.uid;
    setProcessingId(patientId);

    try {
      const batch = writeBatch(db);

      // 1. Eliminar de la bandeja activa
      const requestRef = doc(
        db,
        'professionals',
        profId,
        'link_requests',
        patientId
      );
      batch.delete(requestRef);

      // 2. Actualizar estado en el perfil del paciente
      const patientRef = doc(db, 'patients', patientId);
      batch.update(patientRef, {
        [`careTeam.${profId}.status`]: resolution,
      });

      // 3. Escribir en el historial pasivo del profesional usando merge
      const profRef = doc(db, 'professionals', profId);
      batch.set(
        profRef,
        {
          patientsHistory: {
            [patientId]: {
              patientName: patientName,
              status: resolution,
              resolvedAt: new Date().toISOString(),
            },
          },
        },
        { merge: true }
      );

      await batch.commit();
    } catch (error) {
      console.error('Error al procesar la solicitud:', error);
      alert('Hubo un error al procesar la solicitud.');
    } finally {
      setProcessingId(null);
    }
  };

  // Si está cargando o NO hay solicitudes, no renderizamos absolutamente nada.
  if (loading || requests.length === 0) return null;

  return (
    <div className="bg-orange-900/20 border border-orange-500/50 p-5 rounded-xl shadow-lg mb-6 animate-fadeIn">
      <h3 className="text-orange-400 font-bold mb-4 flex items-center gap-2">
        <span className="text-xl">⚠️</span>
        Nuevas Solicitudes de Vinculación ({requests.length})
      </h3>

      <div className="space-y-3">
        {requests.map((req) => (
          <div
            key={req.patientId}
            className="bg-slate-800/80 border border-orange-500/30 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors hover:bg-slate-800"
          >
            <div>
              <div className="font-bold text-white text-lg">
                {req.patientName}
              </div>
              <div className="text-xs text-orange-300 mt-1">
                Fecha de solicitud:{' '}
                {new Date(req.requestedAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                disabled={processingId === req.patientId}
                onClick={() =>
                  handleResolveRequest(
                    req.patientId,
                    req.patientName,
                    'rejected'
                  )
                }
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-red-400 border border-red-500/50 rounded hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
              >
                Rechazar
              </button>
              <button
                disabled={processingId === req.patientId}
                onClick={() =>
                  handleResolveRequest(req.patientId, req.patientName, 'active')
                }
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors disabled:opacity-50"
              >
                {processingId === req.patientId ? 'Procesando...' : 'Aceptar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
