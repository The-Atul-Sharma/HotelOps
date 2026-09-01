import dayjs from 'dayjs';
import type { DateRange } from '@/types';

export type RangePreset = 'today' | 'week' | 'month' | 'lastMonth' | 'all' | 'custom';

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  lastMonth: 'Last Month',
  all: 'All Time',
  custom: 'Custom Range',
};

export function presetToRange(preset: RangePreset): DateRange {
  const now = dayjs();
  switch (preset) {
    case 'today':
      return { from: now.startOf('day').format('YYYY-MM-DD'), to: now.endOf('day').format('YYYY-MM-DD') };
    case 'week':
      return { from: now.startOf('week').format('YYYY-MM-DD'), to: now.endOf('week').format('YYYY-MM-DD') };
    case 'month':
      return { from: now.startOf('month').format('YYYY-MM-DD'), to: now.endOf('month').format('YYYY-MM-DD') };
    case 'lastMonth': {
      const lm = now.subtract(1, 'month');
      return { from: lm.startOf('month').format('YYYY-MM-DD'), to: lm.endOf('month').format('YYYY-MM-DD') };
    }
    case 'custom':
      return { from: now.startOf('month').format('YYYY-MM-DD'), to: now.format('YYYY-MM-DD') };
    case 'all':
    default:
      return { from: '2000-01-01', to: '2999-12-31' };
  }
}

export function inRange(date: string, range: DateRange): boolean {
  const d = dayjs(date);
  return (
    (d.isAfter(dayjs(range.from).startOf('day')) || d.isSame(dayjs(range.from), 'day')) &&
    (d.isBefore(dayjs(range.to).endOf('day')) || d.isSame(dayjs(range.to), 'day'))
  );
}
