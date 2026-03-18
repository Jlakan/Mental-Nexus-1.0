import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

interface PaymentMethods {
  cash: number;
  transfer: number;
  card: number;
}

interface MonthData {
  ingresoReal: number;
  proyectado: number;
  cuentasPorCobrar: number;
  costoAusentismo: number;
  metodos: PaymentMethods;
}

interface YearData {
  year: number;
  months: Record<string, MonthData>;
}

interface FinancialPanelProps {
  professionalId: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DEFAULT_MONTH_DATA: MonthData = {
  ingresoReal: 0,
  proyectado: 0,
  cuentasPorCobrar: 0,
  costoAusentismo: 0,
  metodos: { cash: 0, transfer: 0, card: 0 }
};

export const FinancialPanel: React.FC<FinancialPanelProps> = ({ professionalId }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showFinances, setShowFinances] = useState<boolean>(false);
  const [yearData, setYearData] = useState<YearData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);

  const currentYear = selectedDate.getFullYear();
  const currentMonthIdx = selectedDate.getMonth();
  const currentMonthStr = currentMonthIdx.toString().padStart(2, '0');
  const prevMonthStr = (currentMonthIdx - 1).toString().padStart(2, '0');

  useEffect(() => {
    fetchYearData();
  }, [currentYear, professionalId]);

  const fetchYearData = async () => {
    setIsLoading(true);
    try {
      const db = getFirestore();
      const docRef = doc(db, 'professionals', professionalId, 'finances', currentYear.toString());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setYearData(docSnap.data() as YearData);
      } else {
        setYearData(null);
      }
    } catch (error) {
      console.error("Error obteniendo datos financieros:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- LÓGICA DE RECALCULAR DESDE LA AGENDA VIEJA ---
  const handleRecalculateMonth = async () => {
    setIsRecalculating(true);
    try {
      const db = getFirestore();
      const monthId = `${currentYear}_${currentMonthStr}`;
      
      // 1. Leer la agenda original de ese mes
      const agendaRef = doc(db, "professionals", professionalId, "availability", monthId);
      const agendaSnap = await getDoc(agendaRef);
      
      let newMonthData: MonthData = {
        ingresoReal: 0, proyectado: 0, cuentasPorCobrar: 0, costoAusentismo: 0, metodos: { cash: 0, transfer: 0, card: 0 }
      };

      if (agendaSnap.exists()) {
        const slots = agendaSnap.data().slots || {};
        const now = new Date();

        Object.entries(slots).forEach(([key, slot]: [string, any]) => {
          if (!slot || typeof slot !== 'object' || !slot.status) return;
          const price = Number(slot.price) || 0;

          // Inteligencia Temporal
          const [dStr, tStr] = key.split('_');
          let isPast = false;
          if (dStr && tStr && tStr.length === 4) {
            const sH = parseInt(tStr.substring(0, 2));
            const sM = parseInt(tStr.substring(2));
            const slotDateObj = new Date(currentYear, currentMonthIdx, parseInt(dStr), sH, sM);
            isPast = slotDateObj < now;
          }

          if (slot.status === 'completed' || slot.status === 'booked') {
            const isEffectivelyCompleted = slot.status === 'completed' || isPast;

            if (isEffectivelyCompleted) {
              newMonthData.ingresoReal += price;
              if (slot.paymentStatus === 'pending') {
                newMonthData.cuentasPorCobrar += price;
              } else if (slot.paymentStatus === 'paid') {
                if (slot.paymentMethod === 'transfer') newMonthData.metodos.transfer += price;
                else if (slot.paymentMethod === 'card') newMonthData.metodos.card += price;
                else newMonthData.metodos.cash += price; // Por defecto a efectivo
              } else {
                 // Si no tiene status de pago pero ya pasó, asumimos cuentas por cobrar
                 newMonthData.cuentasPorCobrar += price;
              }
            } else {
              newMonthData.proyectado += price; 
            }
          } else if (slot.status === 'cancelled' && slot.adminNotes?.includes('AUSENCIA')) {
            newMonthData.costoAusentismo += price;
          }
        });
      }

      // 2. Guardar los totales calculados en la nueva colección 'finances'
      const financeDocRef = doc(db, 'professionals', professionalId, 'finances', currentYear.toString());
      const financeSnap = await getDoc(financeDocRef);

      if (financeSnap.exists()) {
        await updateDoc(financeDocRef, {
          [`months.${currentMonthStr}`]: newMonthData
        });
      } else {
        // Crear el documento del año si no existe
        const initialData = {
           year: currentYear,
           months: { [currentMonthStr]: newMonthData }
        };
        await setDoc(financeDocRef, initialData);
      }

      // 3. Recargar la interfaz
      await fetchYearData();
      alert(`✅ Datos del mes de ${MONTH_NAMES[currentMonthIdx]} recalculados y sincronizados correctamente.`);

    } catch (error) {
      console.error("Error recalculando mes:", error);
      alert("Hubo un error al recalcular los datos.");
    } finally {
      setIsRecalculating(false);
    }
  };


  // Funciones de navegación
  const handlePrevMonth = () => {
    setSelectedDate(new Date(currentYear, currentMonthIdx - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(currentYear, currentMonthIdx + 1, 1));
  };

  // Obtención segura de datos del mes
  const getMonthData = (monthStr: string): MonthData => {
    return yearData?.months?.[monthStr] || DEFAULT_MONTH_DATA;
  };

  const currentData = getMonthData(currentMonthStr);
  const prevData = getMonthData(prevMonthStr);

  // Cálculo de comparativa
  const calculateGrowth = (current: number, previous: number) => {
    if (currentMonthIdx === 0) return null; // No hay mes anterior en el mismo documento
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const growthPct = calculateGrowth(currentData.ingresoReal, prevData.ingresoReal);

  // Formateo visual
  const formatCurrency = (amount: number) => {
    if (!showFinances) return '***';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  // Cálculo para la gráfica de barras
  const allMonthsData = Array.from({ length: 12 }).map((_, i) => getMonthData(i.toString().padStart(2, '0')));
  const maxIngreso = Math.max(...allMonthsData.map(d => d.ingresoReal), 1); // Evitar división por cero

  // Exportar a CSV
  const exportToCSV = () => {
    const headers = ['Mes', 'Ingreso Real', 'Proyectado', 'Cuentas Por Cobrar', 'Costo Ausentismo', 'Efectivo', 'Transferencia', 'Tarjeta'];
    const rows = allMonthsData.map((data, index) => [
      MONTH_NAMES[index],
      data.ingresoReal,
      data.proyectado,
      data.cuentasPorCobrar,
      data.costoAusentismo,
      data.metodos.cash,
      data.metodos.transfer,
      data.metodos.card
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Financiero_${currentYear}.csv`;
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-800 text-slate-200 p-6 rounded-xl w-full font-sans shadow-lg">
      
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center space-x-4 bg-slate-700 rounded-lg p-1">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-600 rounded transition-colors">◀</button>
          <span className="font-semibold text-lg min-w-[140px] text-center uppercase tracking-widest">
            {MONTH_NAMES[currentMonthIdx]} {currentYear}
          </span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-600 rounded transition-colors">▶</button>
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={handleRecalculateMonth}
             disabled={isRecalculating}
             className="flex items-center gap-2 bg-nexus-cyan text-slate-900 font-bold px-4 py-2 rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50"
             title="Extrae los datos de la agenda y actualiza este reporte"
           >
             {isRecalculating ? '⏳ Calculando...' : '🔄 Recalcular'}
           </button>
           <button 
             onClick={() => setShowFinances(!showFinances)}
             className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
           >
             {showFinances ? '👁️ Ocultar' : '🙈 Mostrar'}
           </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-400">Cargando métricas...</div>
      ) : (
        <>
          {/* Métricas Principales (Grid 4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-700 p-5 rounded-lg border border-slate-600 flex flex-col justify-between">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Ingreso ya cobrado</h3>
              <p className="text-2xl font-bold text-white mb-2">{formatCurrency(currentData.ingresoReal)}</p>
              {currentMonthIdx !== 0 && growthPct !== null && (
                <div className={`text-sm font-bold ${growthPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {growthPct >= 0 ? '🔼 +' : '🔽 '}{growthPct.toFixed(1)}% vs mes anterior
                </div>
              )}
              {currentMonthIdx === 0 && <div className="text-sm text-slate-500">- Inicio de año</div>}
            </div>

            <div className="bg-slate-700 p-5 rounded-lg border border-slate-600">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Cuentas por Cobrar</h3>
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(currentData.cuentasPorCobrar)}</p>
              <div className="text-xs text-slate-400 mt-1">Citas pasadas no pagadas</div>
            </div>

            <div className="bg-slate-700 p-5 rounded-lg border border-slate-600">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Costo Ausentismo</h3>
              <p className="text-2xl font-bold text-rose-400">{formatCurrency(currentData.costoAusentismo)}</p>
              <div className="text-xs text-slate-400 mt-1">Fugas por inasistencia</div>
            </div>

            <div className="bg-slate-700 p-5 rounded-lg border border-slate-600">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Por cobrar en citas futuras</h3>
              <p className="text-2xl font-bold text-cyan-400">{formatCurrency(currentData.proyectado)}</p>
              <div className="text-xs text-slate-400 mt-1">En agenda futura</div>
            </div>
          </div>

          {/* Fila Inferior (Grid 3 columnas) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            
            {/* Columna 1: Desglose de Métodos */}
            <div className="col-span-1 bg-slate-700 p-5 rounded-lg border border-slate-600 flex flex-col justify-between">
              <h3 className="text-slate-300 font-semibold mb-4">Métodos de Pago</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">💵 Efectivo</span>
                    <span className="font-medium">{formatCurrency(currentData.metodos.cash)}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${(currentData.metodos.cash / (currentData.ingresoReal || 1)) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">🏦 Transferencia</span>
                    <span className="font-medium">{formatCurrency(currentData.metodos.transfer)}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${(currentData.metodos.transfer / (currentData.ingresoReal || 1)) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">💳 Tarjeta</span>
                    <span className="font-medium">{formatCurrency(currentData.metodos.card)}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div className="bg-purple-400 h-2 rounded-full" style={{ width: `${(currentData.metodos.card / (currentData.ingresoReal || 1)) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Columnas 2 y 3: Gráfica de Barras */}
            <div className="col-span-1 lg:col-span-2 bg-slate-700 p-5 rounded-lg border border-slate-600 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-slate-300 font-semibold mb-4">Tendencia Anual (Ingreso Real)</h3>
                <span className="text-[10px] text-slate-500">Basado en ingresos cobrados</span>
              </div>
              
              <div className="flex-1 flex items-end gap-2 h-40">
                {allMonthsData.map((data, index) => {
                  const heightPercentage = (data.ingresoReal / maxIngreso) * 100;
                  const isCurrentMonth = index === currentMonthIdx;
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-900 text-white text-xs py-1 px-2 rounded pointer-events-none transition-opacity z-10 whitespace-nowrap shadow-lg border border-slate-600">
                        {showFinances ? `$${data.ingresoReal.toLocaleString('es-MX')}` : '***'}
                      </div>
                      
                      <div 
                        className={`w-full rounded-t-sm transition-all duration-500 ease-out ${
                          isCurrentMonth ? 'bg-emerald-400' : 'bg-cyan-600 hover:bg-cyan-500'
                        }`}
                        style={{ height: `${heightPercentage}%`, minHeight: data.ingresoReal > 0 ? '4px' : '2px' }}
                      />
                      <span className={`text-[10px] mt-2 uppercase ${isCurrentMonth ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                        {MONTH_NAMES[index].substring(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Botón de Descarga */}
          <div className="flex justify-between items-center border-t border-slate-700 pt-4">
             <span className="text-xs text-slate-500">Datos consolidados en la base de datos de finanzas.</span>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-600 text-slate-200 px-5 py-2.5 rounded-lg transition-colors font-medium border border-slate-600"
            >
              📥 Exportar CSV Anual
            </button>
          </div>
        </>
      )}
    </div>
  );
};