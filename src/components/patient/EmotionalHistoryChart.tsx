// src/components/patient/EmotionalHistoryChart.tsx
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { AtlasCard, AtlasIcons } from './AtlasDesignSystem';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface EmotionalHistoryChartProps {
  patientId: string;
}

const emojis = ['❌', '😫', '😕', '😐', '🙂', '🤩'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-cyan-500/50 p-3 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] backdrop-blur-sm">
        <p className="text-cyan-400 text-xs font-mono mb-1">{label}</p>
        <p className="text-white font-bold flex items-center gap-2 text-lg">
          {emojis[data.mood]} <span className="text-sm">Nivel {data.mood}</span>
        </p>
        {data.note && (
          <p className="text-slate-400 text-xs mt-1 italic">"{data.note}"</p>
        )}
      </div>
    );
  }
  return null;
};

export default function EmotionalHistoryChart({
  patientId,
}: EmotionalHistoryChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!patientId) return;

    const logsRef = collection(db, 'patients', patientId, 'emotional_logs');
    const q = query(logsRef, orderBy('createdAt', 'desc'), limit(14));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: any[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const dateObj = data.createdAt?.toDate() || new Date();

        const formattedDate = dateObj.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
        });

        logs.push({
          id: doc.id,
          date: formattedDate,
          mood: data.mood,
          note: data.note || '',
          timestamp: dateObj.getTime(),
        });
      });

      setChartData(logs.sort((a, b) => a.timestamp - b.timestamp));
    });

    return () => unsubscribe();
  }, [patientId]);

  return (
    <div className="space-y-4 w-full">
      <AtlasCard className="bg-slate-800 border-cyan-900/50 shadow-lg">
        <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <AtlasIcons.Zap className="text-cyan-400" />
            MÉTRICAS NEURALES
          </h3>
          <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-cyan-500 border border-slate-700 uppercase">
            Últimos 14 días
          </span>
        </div>

        <div className="w-full h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => emojis[value] || ''}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{
                    stroke: '#334155',
                    strokeWidth: 2,
                    strokeDasharray: '5 5',
                  }}
                />
                <ReferenceLine y={3} stroke="#334155" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: '#0f172a',
                    stroke: '#06b6d4',
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    fill: '#06b6d4',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-xs uppercase">
              Calibrando sensores... No hay datos suficientes.
            </div>
          )}
        </div>
      </AtlasCard>
    </div>
  );
}
