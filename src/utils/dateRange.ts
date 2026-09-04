import { appDay, appNow } from '@/lib/dayjs';
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
  const now = appNow();
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
  const d = appDay(date);
  return (
    (d.isAfter(appDay(range.from).startOf('day')) || d.isSame(appDay(range.from), 'day')) &&
    (d.isBefore(appDay(range.to).endOf('day')) || d.isSame(appDay(range.to), 'day'))
  );
}

export function formatRangePeriodLabel(preset: RangePreset, range: DateRange): string {
  switch (preset) {
    case 'today':
      return appDay(range.from).format('D MMMM YYYY');
    case 'week': {
      const from = appDay(range.from);
      const to = appDay(range.to);
      if (from.isSame(to, 'year')) {
        return `${from.format('D MMM')} – ${to.format('D MMM YYYY')}`;
      }
      return `${from.format('D MMM YYYY')} – ${to.format('D MMM YYYY')}`;
    }
    case 'month':
    case 'lastMonth':
      return appDay(range.from).format('MMMM YYYY');
    case 'all':
      return 'All Time';
    case 'custom': {
      const from = appDay(range.from);
      const to = appDay(range.to);
      if (from.isSame(to, 'day')) return from.format('D MMMM YYYY');
      if (from.isSame(to, 'year')) {
        return `${from.format('D MMM')} – ${to.format('D MMM YYYY')}`;
      }
      return `${from.format('D MMM YYYY')} – ${to.format('D MMM YYYY')}`;
    }
  }
}
