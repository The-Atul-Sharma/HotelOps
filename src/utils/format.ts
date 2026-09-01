import dayjs from 'dayjs';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrFormatterDecimal = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN');

export function formatINR(value: number, decimals = false): string {
  if (Number.isNaN(value)) return '₹0';
  return decimals ? inrFormatterDecimal.format(value) : inrFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatDate(date?: string | Date | null, fmt = 'DD MMM YYYY'): string {
  if (!date) return '-';
  return dayjs(date).format(fmt);
}

export function formatDateTime(date?: string | Date | null): string {
  if (!date) return '-';
  return dayjs(date).format('DD MMM YYYY, hh:mm A');
}

export function relativeTime(date: string | Date): string {
  const now = dayjs();
  const then = dayjs(date);
  const diffMin = now.diff(then, 'minute');
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = now.diff(then, 'hour');
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = now.diff(then, 'day');
  if (diffDay < 30) return `${diffDay}d ago`;
  return then.format('DD MMM YYYY');
}
