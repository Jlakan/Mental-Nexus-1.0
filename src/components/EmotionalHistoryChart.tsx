// src/components/EmotionalHistoryChart.tsx

import { AtlasCard, AtlasIcons } from './design/AtlasDesignSystem';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

// --- DATOS SIMULADOS (14 DÍAS) ---
// 1: 😫, 2: 😕, 3: 😐, 4: 🙂, 5: 🤩
const mockData = [
  { date: '28 Feb', mood: 3, note: 'Neutral' },
  { date: '01 Mar', mood: 2, note: 'Cansado' },
  { date: '02 Mar', mood: 4, note: 'Buen avance' },
  { date: '03 Mar', mood: 4, note: 'Tranquilo' },
  { date: '04 Mar', mood: 5, note: 'Excelente sesión' },
  { date: '05 Mar', mood: 3, note: 'Estable' },
  { date: '06 Mar', mood: 2, note: 'Día difícil' },
  { date: '07 Mar', mood: 3, note: 'Recuperando' },
  { date: '08 Mar', mood: 4, note: 'Motivado' },
  { date: '09 Mar', mood: 4, note: 'Estable' },
  { date: '10 Mar', mood: 5, note: 'Completé todo' },
  { date: '11 Mar', mood: 3, note: 'Neutral' },
  { date: '12 Mar', mood: 4, note: 'Tranquilo' },
  { date: '13 Mar', mood: 4, note: 'Hoy' },
];

// --- TOOLTIP PERSONALIZADO (Estilo Cyberpunk/Clínico) ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const emojis = ['❌', '😫', '😕', '😐', '🙂', '🤩'];
    
    return (
      <div className="bg-slate-900/95 border border-cyan-500/50 p-3 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] backdrop-blur-sm">
        <p className="text-cyan-400 text-xs font-mono mb-1">{label}</p>
        <p className="text-white font-bold flex items-center gap-2 text-lg">
          {emojis[data.mood]} <span className="text-sm">Nivel {data.mood}</span>
        </p>
        <p className="text-slate-400 text-xs mt-1 italic">"{data.note}"</p>
      </div>
    );
  }
  return null;
};

export default function EmotionalHistoryChart() {
  return (
    <AtlasCard className="bg-slate-800 border-cyan-900/50 shadow-lg w-full">
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
      <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <defs>
              {/* Gradiente para el brillo de la línea */}
              <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            
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
              tickFormatter={(value) => {
                const emojis = ['', '😫', '😕', '😐', '🙂', '🤩'];
                return emojis[value] || '';
              }}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 2, strokeDasharray: '5 5' }} />
            
            {/* Línea base de estabilidad (Nivel 3 - Neutral) */}
            <ReferenceLine y={3} stroke="#334155" strokeDasharray="3 3" />
            
            <Line 
              type="monotone" 
              dataKey="mood" 
              stroke="#06b6d4" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#0f172a', stroke: '#06b6d4', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
          Tendencia de estabilidad emocional
        </p>
      </div>
    </AtlasCard>
  );
}