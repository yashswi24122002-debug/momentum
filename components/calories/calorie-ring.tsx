const SIZE = 160;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const remaining = goal - consumed;
  const over = remaining < 0;

  // Under/at goal: a single green arc, same as before. Over goal: the
  // green arc completes a full lap (you hit your goal), then a red arc is
  // overlaid starting from the same top point, sized to how far past goal
  // you went — e.g. 200 over a 2000 goal draws a red arc covering 10% of
  // the ring, not the whole ring turning red regardless of by how much.
  const basePct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const overPct = over && goal > 0 ? Math.min(1, -remaining / goal) : 0;
  const baseOffset = CIRCUMFERENCE * (1 - basePct);
  const overOffset = CIRCUMFERENCE * (1 - overPct);

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
          strokeDashoffset={baseOffset}
          className="fill-none stroke-primary transition-all"
        />
        {over && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={overOffset}
            className="fill-none stroke-danger transition-all"
          />
        )}
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
