import { cn } from '@/lib/utils';
import type { PaymentStatus, RoomStatus, BookingStatus } from '@/types';

const dot = 'mr-1.5 h-1.5 w-1.5 rounded-full';

const base =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap';

const paymentStyles: Record<PaymentStatus, string> = {
  PAID: 'border-transparent bg-success/15 text-success',
  PARTIAL: 'border-transparent bg-warning/15 text-warning',
  PENDING: 'border-transparent bg-destructive/15 text-destructive',
  OVERDUE: 'border-destructive/40 bg-destructive/20 text-destructive',
};

const paymentDot: Record<PaymentStatus, string> = {
  PAID: 'bg-success',
  PARTIAL: 'bg-warning',
  PENDING: 'bg-destructive',
  OVERDUE: 'bg-destructive',
};

function formatShort(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function PaymentStatusBadge({
  status,
  pending,
  paid,
  total,
  className,
}: {
  status: PaymentStatus;
  pending?: number;
  paid?: number;
  total?: number;
  className?: string;
}) {
  let label =
    status === 'PAID'
      ? 'Paid'
      : status === 'PARTIAL'
        ? 'Partial'
        : status === 'OVERDUE'
          ? 'Overdue'
          : 'Pending';
  if ((status === 'PENDING' || status === 'OVERDUE') && pending !== undefined) {
    label += ` ${formatShort(pending)}`;
  } else if (status === 'PARTIAL' && paid !== undefined && total !== undefined) {
    label += ` ${formatShort(paid)} / ${formatShort(total)}`;
  }
  return (
    <span className={cn(base, paymentStyles[status], className)} title={label}>
      <span className={cn(dot, paymentDot[status], status === 'OVERDUE' && 'animate-pulse')} />
      {label}
    </span>
  );
}

const roomStyles: Record<RoomStatus, string> = {
  Available: 'border-transparent bg-success/15 text-success',
  Occupied: 'border-transparent bg-primary/15 text-primary',
  Reserved: 'border-transparent bg-warning/15 text-warning',
  Cleaning: 'border-transparent bg-muted text-muted-foreground',
  Maintenance: 'border-transparent bg-destructive/15 text-destructive',
  Blocked: 'border-transparent bg-foreground/10 text-foreground',
};

export function RoomStatusBadge({ status, className }: { status: RoomStatus; className?: string }) {
  return <span className={cn(base, roomStyles[status], className)}>{status}</span>;
}

const bookingStyles: Record<BookingStatus, string> = {
  Inquiry: 'border-transparent bg-muted text-muted-foreground',
  Reserved: 'border-transparent bg-warning/15 text-warning',
  'Checked In': 'border-transparent bg-primary/15 text-primary',
  'Checked Out': 'border-transparent bg-success/15 text-success',
  Cancelled: 'border-transparent bg-destructive/15 text-destructive',
  'No Show': 'border-transparent bg-orange-500/15 text-orange-500',
};

export function BookingStatusBadge({
  status,
  className,
}: {
  status: BookingStatus;
  className?: string;
}) {
  return <span className={cn(base, bookingStyles[status], className)}>{status}</span>;
}
