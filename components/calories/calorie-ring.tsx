const SIZE = 160;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const offset = CIRCUMFERENCE * (1 - pct);
  const remaining = goal - consumed;
  const over = remaining < 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} className="fill-none stroke-surface-hover" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={`fill-none transition-all ${over ? "stroke-danger" : "stroke-primary"}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-semibold ${over ? "text-danger" : "text-text-primary"}`}>
          {Math.abs(remaining)}
        </span>
        <span className="text-xs text-text-muted">{over ? "over goal" : "remaining"}</span>
      </div>
    </div>
  );
}
