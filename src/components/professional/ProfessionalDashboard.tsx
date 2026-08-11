// src/components/professional/ProfessionalDashboard.tsx
import { useEffect, useState } from 'react';
import {
  doc,
  updateDoc,
  setDoc,
  writeBatch,
  increment,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

// Importamos componentes locales
import { FinancialPanel } from './FinancialPanel';
import AgendaView from '../agenda';
import AssignmentModal from './AssignmentModal';
import HistoryModal from './HistoryModal';
import DashboardMenu from './DashboardMenu';
import PatientDirectory from './PatientDirectory';
import DashboardHeader from './DashboardHeader';
import TaskProgressBar from './TaskProgressBar';
import DashboardAnimatedCards from './DashboardAnimatedCards';
import { ClinicalNotesPanel } from './ClinicalNotesPanel';
import { PatientVisualStats } from './PatientVisualStats';
import LinkRequestsManager from './LinkRequestsManager';
import ProfessionalAnalytics from './ProfessionalAnalytics';
import PatientMergeModal from './PatientMergeModal';

// Importamos el Hook desde la misma carpeta del dominio
import { useProfessionalDashboard } from './useProfessionalDashboard';
import { useTagsDictionary } from '../../hooks/useTagsDictionary';

interface Props {
  user: any;
}

export default function ProfessionalDashboard({ user }: Props) {
  const { state, actions } = useProfessionalDashboard(user);

  const [tagsCatalog, setTagsCatalog] = useState<Record<string, string>>({});
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const professionToUse = state.profData?.professionType || 'psicologia';
  const { dictionary } = useTagsDictionary(professionToUse);

  useEffect(() => {
    const LOCAL_DICTIONARY = {
      desvelo: 'Insomnio',
      'no duermo': 'Insomnio',
      triste: 'Bajo Estado de Ánimo',
      tristeza: 'Bajo Estado de Ánimo',
      llanto: 'Labilidad Emocional',
      nervioso: 'Ansiedad',
      nervios: 'Ansiedad',
      panico: 'Crisis de Pánico',
      miedo: 'Temor',
      cansado: 'Fatiga',
      agotado: 'Fatiga',
    };
    setTagsCatalog(LOCAL_DICTIONARY);
  }, []);

  const normalizeTag = (rawText: string): string => {
    const lower = rawText.toLowerCase().trim();
    return tagsCatalog[lower] ? tagsCatalog[lower] : lower;
  };

  const hasValidAttendance = (patient: any) => {
    if (!patient?.lastAttendance?.[user.uid]) return false;
    const d = patient.lastAttendance[user.uid].toDate
      ? patient.lastAttendance[user.uid].toDate()
      : new Date(patient.lastAttendance[user.uid]);
    return Math.ceil(Math.abs(new Date().getTime() - d.getTime()) / 36e5) <= 72;
  };

  const handleRegisterAttendance = async () => {
    if (!state.selectedPatient || (state.profData?.nexusBalance || 0) < 1)
      return alert('❌ Saldo Nexus insuficiente');
    if (!window.confirm('¿Registrar asistencia y descontar 1 Nexus?')) return;

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'professionals', user.uid), {
        nexusBalance: increment(-1),
        'metrics.nexusDistributed': increment(1),
      });
      batch.update(doc(db, 'patients', state.selectedPatient.id), {
        [`lastAttendance.${user.uid}`]: serverTimestamp(),
        'gamificationProfile.currentXp': increment(50),
        'gamificationProfile.wallet.nexus': increment(1),
      });
      await batch.commit();

      alert('✅ Asistencia registrada. +50 XP al paciente.');

      actions.setProfData((p: any) =>
        p ? { ...p, nexusBalance: (p.nexusBalance || 0) - 1 } : null
      );
      actions.setSelectedPatient((p: any) => ({
        ...p,
        lastAttendance: { ...p.lastAttendance, [user.uid]: new Date() },
      }));
      actions.setTaskToEdit(null);
      actions.setIsAssignmentModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCreateTask = () => {
    if (!hasValidAttendance(state.selectedPatient))
      return handleRegisterAttendance();
    actions.setTaskToEdit(null);
    actions.setIsAssignmentModalOpen(true);
  };

  const handleDeleteTask = async (tid: string) => {
    if (!window.confirm('¿Eliminar esta tarea del plan activo?')) return;
    try {
      const planRef = doc(db, 'active_plans', state.selectedPatient.id);
      await updateDoc(planRef, {
        [`activeTasks.${tid}`]: deleteField(),
      });
      actions.loadPatientTasks(state.selectedPatient.id);
    } catch (e) {
      console.error('Error eliminando tarea:', e);
      alert('Error al intentar eliminar la tarea.');
    }
  };

  // --- NUEVAS FUNCIONES DE ESCRITURA BLINDADA ---
  const handleAddIndicator = async (text: string) => {
    if (!text.trim() || !state.selectedPatient) return;

    // Normalizamos y obligamos a que todo sea MAYÚSCULAS
    const rawClean = normalizeTag(text);
    const cleanTag = rawClean.toUpperCase();

    const currentTags = state.selectedPatient.clinicalTags || [];
    const existingIndex = currentTags.findIndex((t: any) => t.tag === cleanTag);

    let newTags = [...currentTags];

    if (existingIndex >= 0) {
      if (newTags[existingIndex].status === 'Activo') return; // Ya lo tiene, no hacemos nada
      // Si estaba resuelto, lo reactivamos
      newTags[existingIndex] = {
        ...newTags[existingIndex],
        status: 'Activo',
        resolvedAt: null,
      };
    } else {
      // Es un síntoma nuevo
      newTags.push({
        tag: cleanTag,
        status: 'Activo',
        assignedAt: new Date(),
        resolvedAt: null,
      });
    }

    try {
      const tagsRef = doc(
        db,
        'patients',
        state.selectedPatient.id,
        'professionalTags',
        user.uid
      );
      await setDoc(
        tagsRef,
        {
          professionalId: user.uid,
          tags: newTags,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      // Actualizamos estado local
      actions.setSelectedPatient({
        ...state.selectedPatient,
        clinicalTags: newTags,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveIndicator = async (tagText: string) => {
    const currentTags = state.selectedPatient.clinicalTags || [];
    const newTags = currentTags.map((t: any) => {
      if (t.tag === tagText) {
        return { ...t, status: 'Resuelto', resolvedAt: new Date() };
      }
      return t;
    });

    try {
      const tagsRef = doc(
        db,
        'patients',
        state.selectedPatient.id,
        'professionalTags',
        user.uid
      );
      await setDoc(
        tagsRef,
        {
          professionalId: user.uid,
          tags: newTags,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      actions.setSelectedPatient({
        ...state.selectedPatient,
        clinicalTags: newTags,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteIndicator = async (tagText: string) => {
    if (
      !window.confirm(
        `¿Borrar definitivamente "${tagText}"? Usa esto solo si fue un error de diagnóstico.`
      )
    )
      return;

    const currentTags = state.selectedPatient.clinicalTags || [];
    const newTags = currentTags.filter((t: any) => t.tag !== tagText);

    try {
      const tagsRef = doc(
        db,
        'patients',
        state.selectedPatient.id,
        'professionalTags',
        user.uid
      );
      await setDoc(
        tagsRef,
        {
          professionalId: user.uid,
          tags: newTags,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      actions.setSelectedPatient({
        ...state.selectedPatient,
        clinicalTags: newTags,
      });
    } catch (e) {
      console.error(e);
    }
  };
  // ---------------------------------------------

  const handleUnlinkPatient = async (patient: any) => {
    if (
      !window.confirm(
        `¿Ocultar a ${patient.fullName} de tu lista? Su expediente seguirá existiendo en la base de datos, pero ya no tendrás acceso a él.`
      )
    )
      return;

    try {
      const patRef = doc(db, 'patients', patient.id);
      const updates: any = {};

      if (patient.careTeam) {
        const teamKey = Object.keys(patient.careTeam).find(
          (k) => patient.careTeam[k].professionalId === user.uid
        );
        if (teamKey) {
          updates[`careTeam.${teamKey}.active`] = false;
          updates[`careTeam.${teamKey}.status`] = 'archived';
        }
      }

      if (patient.isManual) {
        updates.isArchived = true;
      }

      await updateDoc(patRef, updates);
      actions.handleNavigate('patients_manage');
    } catch (error) {
      console.error(error);
      alert('Error al intentar ocultar al paciente.');
    }
  };

  if (state.loading)
    return (
      <div className="min-h-screen bg-nexus-dark flex items-center justify-center text-nexus-cyan animate-pulse">
        CARGANDO SISTEMA CLÍNICO...
      </div>
    );

  if (state.profData && state.profData.isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md text-center border border-slate-700">
          <div className="text-6xl mb-6">⏳</div>
          <h1 className="text-2xl font-bold text-nexus-cyan mb-4">
            Cuenta en Revisión
          </h1>
          <p className="text-slate-400 mb-6">
            Tu perfil profesional ha sido registrado, pero requiere validación
            administrativa.
          </p>
          <div className="bg-slate-900/50 p-4 rounded-lg mb-6 border border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Tu Código de Referencia
            </div>
            <div className="font-mono text-xl font-bold text-white tracking-widest">
              {state.profData.professionalCode || '---'}
            </div>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg w-full"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-nexus-dark text-slate-200 font-sans overflow-hidden">
      <DashboardMenu
        activeView={state.activeView}
        onNavigate={actions.handleNavigate}
        onLogout={() => auth.signOut()}
        isOpen={state.isSidebarOpen}
        onClose={() => actions.setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        <DashboardHeader
          activeView={state.activeView}
          profData={state.profData}
          onOpenSidebar={() => actions.setIsSidebarOpen(true)}
        />

        <div
          className={`flex-1 overflow-y-auto custom-scrollbar ${
            state.activeView === 'agenda' ? 'p-0' : 'p-4 md:p-8'
          }`}
        >
          {state.activeView === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn pb-20">
              <DashboardAnimatedCards
                activePatientsCount={state.activePatients.length}
                nexusBalance={state.profData?.nexusBalance || 0}
                onOpenAnalytics={() => actions.setActiveView('analytics')}
                onToggleFinance={() =>
                  actions.setIsFinancePanelOpen(!state.isFinancePanelOpen)
                }
              />
              {state.isFinancePanelOpen && (
                <div className="animate-fadeIn mt-6">
                  <FinancialPanel professionalId={user.uid} />
                </div>
              )}
              <div className="mt-8">
                <LinkRequestsManager />
              </div>
            </div>
          )}

          {state.activeView === 'patients_manage' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-end mb-2 pt-4">
                <h3 className="text-sm uppercase text-nexus-cyan font-bold tracking-wider">
                  Directorio ({state.activePatients.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsMergeModalOpen(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-2 border border-slate-700"
                  >
                    <span>🧬</span> Fusionar Perfiles
                  </button>
                </div>
              </div>
              <PatientDirectory
                patients={state.activePatients}
                professionalId={user.uid}
                onOpenPatient={actions.handleOpenPatient}
                onUnlink={handleUnlinkPatient}
                onRegisterAttendance={handleRegisterAttendance}
              />
            </div>
          )}

          {state.activeView === 'agenda' && (
            <div className="w-full min-h-full bg-white text-slate-900 relative">
              <AgendaView
                userRole="professional"
                currentUserId={user.uid}
                onBack={() => actions.handleNavigate('dashboard')}
              />
            </div>
          )}

          {state.activeView === 'analytics' && (
            <ProfessionalAnalytics userId={user.uid} />
          )}

          {state.activeView === 'team' && (
            <div className="nexus-card">
              <h2 className="text-xl font-bold text-white mb-4">
                Equipo Clínico Autorizado
              </h2>
              {state.assistants.length === 0 ? (
                <p className="text-slate-500">No hay asistentes vinculados.</p>
              ) : (
                <div className="space-y-2">
                  {state.assistants.map((a) => (
                    <div
                      key={a.uid}
                      className="p-3 bg-slate-800 rounded text-white"
                    >
                      {a.displayName ||
                        a.fullName ||
                        a.name ||
                        a.email ||
                        'Usuario sin nombre'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {state.activeView === 'patient_detail' && state.selectedPatient && (
            <div className="space-y-6 pb-20 animate-fadeIn">
              <button
                onClick={() => actions.setActiveView('patients_manage')}
                className="text-slate-400 hover:text-white flex items-center gap-2 mb-2 text-sm"
              >
                ← Volver al directorio
              </button>

              <div className="nexus-card flex flex-col md:flex-row justify-between md:items-start gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {state.selectedPatient.fullName}
                  </h1>
                  <div className="text-slate-400 text-sm mt-1">
                    {state.selectedPatient.email} •{' '}
                    {state.selectedPatient.contactNumber}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      actions.setTaskForHistory(null);
                      actions.setIsHistoryOpen(true);
                    }}
                    className="btn-secondary text-xs px-3 py-2"
                  >
                    📜 Historial
                  </button>
                  <button
                    onClick={
                      hasValidAttendance(state.selectedPatient)
                        ? handleOpenCreateTask
                        : handleRegisterAttendance
                    }
                    className={`text-xs px-3 py-2 rounded-lg font-bold shadow-lg ${
                      hasValidAttendance(state.selectedPatient)
                        ? 'bg-nexus-cyan text-black'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {hasValidAttendance(state.selectedPatient)
                      ? '+ Asignar Tarea'
                      : '🔓 Habilitar (1 Nexus)'}
                  </button>
                </div>
              </div>

              <PatientVisualStats
                tasks={state.patientTasks}
                indicators={state.selectedPatient.clinicalTags || []}
                onAddTag={handleAddIndicator}
                onDeleteTag={handleDeleteIndicator}
                onResolveTag={handleResolveIndicator}
                dictionary={dictionary}
                profession={professionToUse}
              />

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6 items-start">
                <div
                  className={`space-y-4 ${
                    state.profData?.notas ? 'xl:col-span-7' : 'xl:col-span-12'
                  }`}
                >
                  <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-2">
                    Plan Activo
                  </h3>

                  {state.patientTasks.filter((t) => t.status !== 'completed')
                    .length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-xl">
                      <p className="text-slate-500">No hay tareas activas.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {state.patientTasks
                        .filter((t) => t.status !== 'completed')
                        .map((t) => {
                          const isRoutine = t.type === 'routine';
                          return (
                            <div
                              key={t.id}
                              className={`bg-slate-800 rounded-lg p-4 shadow-lg border-t-4 ${
                                isRoutine
                                  ? 'border-purple-500'
                                  : 'border-orange-500'
                              } group`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span
                                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                      isRoutine
                                        ? 'text-purple-400 bg-purple-900/20'
                                        : 'text-orange-400 bg-orange-900/20'
                                    }`}
                                  >
                                    {isRoutine ? 'Rutina' : 'Misión'}
                                  </span>
                                  <div className="font-bold text-white mt-1 leading-tight">
                                    {t.title}
                                  </div>
                                </div>
                                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      actions.setTaskForHistory(t);
                                      actions.setIsHistoryOpen(true);
                                    }}
                                    className="p-1.5 hover:bg-slate-700 rounded text-blue-400"
                                  >
                                    👁️
                                  </button>
                                  <button
                                    onClick={() => {
                                      actions.setTaskToEdit(t);
                                      actions.setIsAssignmentModalOpen(true);
                                    }}
                                    className="p-1.5 hover:bg-slate-700 rounded text-slate-400"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(t.id)}
                                    className="p-1.5 hover:bg-slate-700 rounded text-red-400"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                              <div className="text-xs text-slate-400 mb-3 truncate">
                                {t.customInstructions ||
                                  t.description ||
                                  'Sin instrucciones.'}
                              </div>
                              <TaskProgressBar task={t} />
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {state.profData?.notas && (
                  <div className="xl:col-span-5 w-full shrink-0 sticky top-4">
                    <ClinicalNotesPanel
                      patientId={state.selectedPatient.id}
                      professionalId={user.uid}
                    />
                  </div>
                )}
              </div>

              <AssignmentModal
                isOpen={state.isAssignmentModalOpen}
                onClose={() => {
                  actions.setIsAssignmentModalOpen(false);
                  actions.setTaskToEdit(null);
                  actions.loadPatientTasks(state.selectedPatient.id);
                }}
                patientId={state.selectedPatient.id}
                professionalId={user.uid}
                patientName={state.selectedPatient.fullName}
                userProfessionId={
                  state.profData?.professionType || 'psychologist'
                }
                taskToEdit={state.taskToEdit}
              />
              <HistoryModal
                isOpen={state.isHistoryOpen}
                onClose={() => {
                  actions.setIsHistoryOpen(false);
                  actions.setTaskForHistory(null);
                }}
                patientId={state.selectedPatient.id}
                patientName={state.selectedPatient.fullName}
                specificTask={state.taskForHistory}
              />
            </div>
          )}
        </div>
      </main>

      {/* MODAL DE FUSIÓN DE PERFILES */}
      <PatientMergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        patients={state.activePatients}
        onMerge={actions.handleManualMergeProfiles}
      />
    </div>
  );
}
