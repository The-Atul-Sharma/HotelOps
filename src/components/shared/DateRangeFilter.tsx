import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RANGE_LABELS,
  type RangePreset,
} from '@/utils/dateRange';
import type { DateRange } from '@/types';

const PRESETS: RangePreset[] = ['today', 'week', 'month', 'lastMonth', 'all', 'custom'];

export function DateRangeFilter({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
}: {
  value: RangePreset;
  onChange: (v: RangePreset) => void;
  customRange?: DateRange;
  onCustomRangeChange?: (range: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value} onValueChange={(v) => onChange(v as RangePreset)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {RANGE_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === 'custom' && customRange && onCustomRangeChange && (
        <>
          <Input
            type="date"
            value={customRange.from}
            onChange={(e) =>
              onCustomRangeChange({ ...customRange, from: e.target.value })
            }
            className="w-[150px] max-w-full min-w-0"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={customRange.to}
            onChange={(e) =>
              onCustomRangeChange({ ...customRange, to: e.target.value })
            }
            className="w-[150px] max-w-full min-w-0"
          />
        </>
      )}
    </div>
  );
}
