import { useMemo, useState } from 'react';
import { appNow } from '@/lib/dayjs';
import type { DateRange } from '@/types';
import { presetToRange, type RangePreset } from '@/utils/dateRange';

export function useDateRange(initial: RangePreset = 'month') {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [customRange, setCustomRange] = useState<DateRange>(() => ({
    from: appNow().startOf('month').format('YYYY-MM-DD'),
    to: appNow().format('YYYY-MM-DD'),
  }));

  const range = useMemo(() => {
    if (preset === 'custom') return customRange;
    return presetToRange(preset);
  }, [preset, customRange]);

  const resetKey = useMemo(() => {
    if (preset === 'custom') return `custom|${customRange.from}|${customRange.to}`;
    return preset;
  }, [preset, customRange]);

  return {
    preset,
    setPreset,
    customRange,
    setCustomRange,
    range,
    resetKey,
    filterProps: {
      value: preset,
      onChange: setPreset,
      customRange,
      onCustomRangeChange: setCustomRange,
    },
  };
}
