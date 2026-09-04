import {
  ResponsiveContainer,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatINR } from '@/utils/format';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

const axisProps = {
  stroke: 'var(--muted-foreground)',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
};

const legendStyle = {
  fontSize: 12,
  color: 'var(--muted-foreground)',
};

const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
  itemStyle: { color: 'var(--muted-foreground)' },
};

function compact(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

const moneyFormatter = (value: unknown) => formatINR(Number(value) || 0);

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export interface RevenueExpensePoint {
  label: string;
  revenue: number;
  expense: number;
}

export function RevenueExpenseChart({ data }: { data: RevenueExpensePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-5)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={56} />
        <Tooltip {...tooltipStyle} formatter={moneyFormatter} />
        <Legend iconType="circle" wrapperStyle={legendStyle} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rev)" />
        <Area type="monotone" dataKey="expense" name="Expenses" stroke="var(--chart-5)" strokeWidth={2} fill="url(#exp)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={56} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--accent)' }} formatter={moneyFormatter} />
        <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentMethodChart({ data }: { data: { name: string; value: number }[] }) {
  const filtered = data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {filtered.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={moneyFormatter} />
        <Legend iconType="circle" wrapperStyle={legendStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function OccupancyChart({ data }: { data: { name: string; value: number }[] }) {
  const colorMap: Record<string, string> = {
    Occupied: 'var(--chart-1)',
    Available: 'var(--chart-2)',
    Reserved: 'var(--chart-3)',
    Maintenance: 'var(--chart-5)',
    Cleaning: 'var(--chart-4)',
    Blocked: 'var(--chart-6)',
  };
  const filtered = data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={filtered} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
          {filtered.map((d, i) => (
            <Cell key={i} fill={colorMap[d.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={legendStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export interface MonthlyProfitPoint {
  label: string;
  income: number;
  expense: number;
  profit: number;
}

export function MonthlyProfitChart({ data }: { data: MonthlyProfitPoint[] }) {
  const monthlyAxis = {
    stroke: 'var(--muted-foreground)',
    fontSize: 12,
    tickLine: false,
    axisLine: false,
  };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...monthlyAxis} />
        <YAxis {...monthlyAxis} tickFormatter={compact} width={56} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--accent)' }} formatter={moneyFormatter} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Income" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Expense" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="profit" name="Profit" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function AccountBalanceChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No balance data yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={compact} width={56} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--accent)' }} formatter={moneyFormatter} />
        <Bar dataKey="value" name="Balance" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
export function PendingPaymentsChart({ data }: { data: { name: string; paid: number; pending: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={compact} />
        <YAxis type="category" dataKey="name" {...axisProps} width={90} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--accent)' }} formatter={moneyFormatter} />
        <Legend iconType="circle" wrapperStyle={legendStyle} />
        <Bar dataKey="paid" name="Paid" stackId="a" fill="var(--chart-2)" radius={[4, 0, 0, 4]} />
        <Bar dataKey="pending" name="Pending" stackId="a" fill="var(--chart-5)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
