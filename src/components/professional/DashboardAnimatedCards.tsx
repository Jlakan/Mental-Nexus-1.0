// src/components/professional/DashboardAnimatedCards.tsx

interface DashboardAnimatedCardsProps {
  activePatientsCount: number;
  nexusBalance: number;
  onOpenAnalytics: () => void;
  onToggleFinance: () => void;
}

const CARDS_DATA = [
  {
    id: 'patients',
    title: 'Pacientes Activos',
    img: 'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Logo%20px%201.jpeg?alt=media&token=b82bd1e1-09d7-415b-91af-4adb6827e559',
  },
  {
    id: 'nexus',
    title: 'Saldo Disponible',
    img: 'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Nexus.jpg?alt=media&token=eba61fcb-a5a1-4b4f-97a4-1344ff2f8d78',
  },
  {
    id: 'analytics',
    title: 'Ver Métricas',
    img: 'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Grafica%20sin%20flecha.jpg?alt=media&token=1a916b56-f589-4702-be98-a2dd6da95b9e',
  },
  {
    id: 'finance',
    title: 'Intel. Financiera',
    img: 'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Oro.jpg?alt=media&token=63d27131-c081-44e7-903f-6877389af694',
  },
];

export default function DashboardAnimatedCards({
  activePatientsCount,
  nexusBalance,
  onOpenAnalytics,
  onToggleFinance,
}: DashboardAnimatedCardsProps) {
  const getCardValue = (index: number) => {
    if (index === 0) return activePatientsCount;
    if (index === 1) return nexusBalance;
    if (index === 2) return 'Rendimiento';
    if (index === 3) return 'Proyecciones';
    return '';
  };

  const getCardAction = (index: number) => {
    if (index === 2) return onOpenAnalytics;
    if (index === 3) return onToggleFinance;
    return undefined;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {CARDS_DATA.map((card, idx) => {
        const onClickPanelAction = getCardAction(idx);

        return (
          <div
            key={card.id}
            onClick={onClickPanelAction}
            className={`relative rounded-xl overflow-hidden shadow-lg h-40 border border-slate-700/50 group transition-colors ${
              onClickPanelAction ? 'cursor-pointer hover:border-nexus-cyan' : ''
            }`}
          >
            {/* Imagen Fija de Fondo */}
            <img
              src={card.img}
              alt={card.title}
              className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700 group-hover:scale-105"
            />

            {/* Degradado oscuro para garantizar legibilidad del texto */}
            <div className="absolute inset-0 bg-gradient-to-t from-nexus-dark/95 via-nexus-dark/50 to-transparent z-10"></div>

            {/* Contenido de la Tarjeta */}
            <div className="absolute inset-0 z-20 p-4 flex flex-col justify-end">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-3xl font-bold text-white drop-shadow-md leading-none">
                    {getCardValue(idx)}
                  </div>
                  <div className="text-xs text-nexus-cyan uppercase tracking-wider font-bold mt-1 drop-shadow-md">
                    {card.title}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
