import { cn } from '@/lib/utils';
import { formatINR } from '@/utils/format';

export function Money({
  value,
  className,
  decimals = false,
  colored = false,
  muteZero = true,
}: {
  value: number;
  className?: string;
  decimals?: boolean;
  colored?: boolean;
  muteZero?: boolean;
}) {
  const color = colored ? (value < 0 ? 'text-destructive' : value > 0 ? 'text-success' : '') : '';
  const isZero = value === 0;
  return (
    <span
      className={cn(
        'tabular-nums',
        color,
        isZero && muteZero && 'text-muted-foreground',
        className,
      )}
    >
      {formatINR(value, decimals)}
    </span>
  );
}
