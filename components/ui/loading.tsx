import { cn } from '@/lib/utils';

const sizeMap = {
  xs: 14,
  sm: 18,
  default: 28,
  lg: 36,
} as const;

export function Loading({
  size = 'default',
  className,
}: {
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const d = sizeMap[size];
  const stroke = size === 'xs' ? 2.5 : 2;
  const r = (d - stroke) / 2;
  const c = Math.PI * 2 * r;

  return (
    <svg
      width={d}
      height={d}
      viewBox={`0 0 ${d} ${d}`}
      className={cn('animate-spin text-primary', className)}
      aria-hidden="true"
    >
      <circle
        cx={d / 2}
        cy={d / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        opacity={0.2}
      />
      <circle
        cx={d / 2}
        cy={d / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * 0.7}
        strokeLinecap="round"
      />
    </svg>
  );
}
