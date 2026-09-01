import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatINR, formatNumber } from '@/utils/format';

export interface KpiProps {
  label: string;
  value: number;
  icon: LucideIcon;
  format?: 'currency' | 'number';
  tone?: 'default' | 'success' | 'warning' | 'destructive' | 'primary';
  delta?: number;
  hint?: string;
}

const toneStyles: Record<NonNullable<KpiProps['tone']>, string> = {
  default: 'bg-muted text-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  primary: 'bg-primary/15 text-primary',
};

export function KpiCard({ label, value, icon: Icon, format = 'currency', tone = 'default', delta, hint }: KpiProps) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', toneStyles[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {format === 'currency' ? formatINR(value) : formatNumber(value)}
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                delta >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
