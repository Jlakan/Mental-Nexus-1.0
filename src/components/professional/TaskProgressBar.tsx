
interface TaskProgressBarProps {
  task: any; // Considera tipar esto más adelante (ej. TaskData)
}

export default function TaskProgressBar({ task }: TaskProgressBarProps) {
  const completed = task.completionHistory
    ? Object.keys(task.completionHistory).length
    : 0;
  const total = task.totalVolumeExpected || 1;
  const percent = Math.min(100, Math.round((completed / total) * 100));

  const createdAt = task.createdAt?.toDate
    ? task.createdAt.toDate()
    : new Date();
  const now = new Date();

  let durationDays = 7;
  if (task.durationWeeks) durationDays = task.durationWeeks * 7;

  const endDate = new Date(createdAt);
  endDate.setDate(endDate.getDate() + durationDays);

  const totalTime = endDate.getTime() - createdAt.getTime();
  const elapsedTime = now.getTime() - createdAt.getTime();
  const timePercent = Math.min(
    100,
    Math.max(0, (elapsedTime / totalTime) * 100)
  );

  let statusColor = 'bg-green-500';
  let statusText = 'A tiempo';
  let statusTextColor = 'text-green-400';

  if (percent >= 100) {
    statusColor = 'bg-green-600';
    statusText = 'Completada';
    statusTextColor = 'text-green-500';
  } else if (percent < timePercent - 15) {
    statusColor = 'bg-red-500';
    statusText = 'Atrasado';
    statusTextColor = 'text-red-400';
  } else if (percent > timePercent + 10) {
    statusColor = 'bg-blue-500';
    statusText = 'Adelantado';
    statusTextColor = 'text-blue-400';
  }

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs mb-1 text-slate-400">
        <span>
          {completed}/{total} reps
        </span>
        <span className={`font-bold ${statusTextColor}`}>{statusText}</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden relative">
        <div
          className={`h-full ${statusColor} transition-all duration-500 rounded-full`}
          style={{ width: `${percent}%` }}
        ></div>
        {percent < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
            style={{ left: `${timePercent}%` }}
            title="Meta hoy"
          />
        )}
      </div>
    </div>
  );
}
