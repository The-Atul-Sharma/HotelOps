import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  HandCoins,
  CalendarArrowDown,
  CalendarArrowUp,
  BedDouble,
  DoorOpen,
  IndianRupee,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  BadgeIndianRupee,
  ConciergeBell,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { LoadingState } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { KpiCard } from './KpiCard';
import {
  ChartCard,
  RevenueExpenseChart,
  CategoryBarChart,
  PaymentMethodChart,
  OccupancyChart,
  MonthlyProfitChart,
  PendingPaymentsChart,
} from './charts';
import { useDashboardData } from './useDashboardData';
import { useDateRange } from '@/hooks/useDateRange';
import { formatINR } from '@/utils/format';

export default function DashboardPage() {
  const { range, filterProps } = useDateRange('month');
  const data = useDashboardData(range);

  if (data.isLoading) return <LoadingState label="Loading dashboard…" />;

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live overview of booking revenue, collections, expenses and occupancy."
        actions={<DateRangeFilter {...filterProps} />}
      />

      <AttentionSection
        pending={k.pending}
        overdueCount={data.overdueCount}
        overdueAmount={data.overdueAmount}
        available={k.available}
        reserved={k.reserved}
        todayBookings={data.todayBookings}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total Revenue" value={k.totalRevenue} icon={TrendingUp} tone="success" />
        <KpiCard label="Room Tariff" value={k.roomTariff} icon={BedDouble} tone="primary" />
        <KpiCard label="Extra Charges" value={k.extrasTotal} icon={ConciergeBell} tone="success" />
        <KpiCard label="Collected" value={k.collected} icon={BadgeIndianRupee} tone="success" />
        <KpiCard label="Total Expenses" value={k.totalExpenses} icon={TrendingDown} tone="destructive" />
        <KpiCard label="Net Profit" value={k.netProfit} icon={IndianRupee} tone="primary" />
        <KpiCard label="Pending Payments" value={k.pending} icon={Clock} tone="warning" />
        <KpiCard label="Advances Given" value={k.advancesGiven} icon={HandCoins} tone="default" />
        <KpiCard label="Today's Collection" value={k.todayCollection} icon={Banknote} tone="success" />
        <KpiCard label="Today's Expenses" value={k.todayExpenses} icon={Wallet} tone="destructive" />
        <KpiCard label="Occupied Rooms" value={k.occupied} icon={BedDouble} tone="primary" format="number" />
        <KpiCard label="Available Rooms" value={k.available} icon={DoorOpen} tone="success" format="number" />
        <KpiCard label="Today's Check-ins" value={k.todayCheckIns} icon={CalendarArrowDown} tone="default" format="number" />
        <KpiCard label="Today's Check-outs" value={k.todayCheckOuts} icon={CalendarArrowUp} tone="default" format="number" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Revenue vs Expenses">
          <RevenueExpenseChart data={data.revenueExpense} />
        </ChartCard>
        <ChartCard title="Monthly Profit">
          <MonthlyProfitChart data={data.monthlyProfit} />
        </ChartCard>
        <ChartCard title="Revenue by Category">
          <CategoryBarChart data={data.revenueByCategory} />
        </ChartCard>
        <ChartCard title="Payment Methods">
          <PaymentMethodChart data={data.paymentMethods} />
        </ChartCard>
        <ChartCard title="Room Occupancy">
          <OccupancyChart data={data.occupancy} />
        </ChartCard>
        <ChartCard title="Outstanding / Pending Payments">
          <PendingPaymentsChart data={data.pendingChart} />
        </ChartCard>
      </div>
    </div>
  );
}

function AttentionSection({
  pending,
  overdueCount,
  overdueAmount,
  available,
  reserved,
  todayBookings,
}: {
  pending: number;
  overdueCount: number;
  overdueAmount: number;
  available: number;
  reserved: number;
  todayBookings: number;
}) {
  const flags: { tone: 'red' | 'yellow' | 'green'; text: string; to: string }[] = [];
  if (pending > 0) flags.push({ tone: 'red', text: `${formatINR(pending)} payment pending`, to: '/accounts/pending' });
  if (overdueCount > 0)
    flags.push({ tone: 'red', text: `${overdueCount} overdue (${formatINR(overdueAmount)})`, to: '/accounts/pending' });
  if (reserved > 0) flags.push({ tone: 'yellow', text: `${reserved} rooms reserved`, to: '/rooms' });
  flags.push({ tone: 'green', text: `${available} rooms available`, to: '/rooms' });
  flags.push({ tone: 'green', text: `${todayBookings} check-ins today`, to: '/bookings' });

  const toneClasses: Record<string, string> = {
    red: 'border-destructive/30 bg-destructive/10 text-destructive',
    yellow: 'border-warning/30 bg-warning/10 text-warning',
    green: 'border-success/30 bg-success/10 text-success',
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h2 className="text-sm font-semibold">Attention Required</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {flags.map((f, i) => (
          <Link
            key={i}
            to={f.to}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${toneClasses[f.tone]}`}
          >
            {f.tone === 'green' ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-current" />
            )}
            {f.text}
          </Link>
        ))}
      </div>
    </Card>
  );
}
