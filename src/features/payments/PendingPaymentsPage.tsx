import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Eye } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, EmptyState } from '@/components/shared/states';
import { PaymentStatusBadge } from '@/components/shared/StatusBadge';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { PaginationBar } from '@/components/shared/Pagination';
import { Money } from '@/components/shared/Money';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBookings } from '@/hooks/useEntities';
import { usePagination } from '@/hooks/usePagination';
import { useDateRange } from '@/hooks/useDateRange';
import { calculatePaymentStatus, bookingPendingAmount, bookingPendingBreakdown, round2 } from '@/utils/finance';
import { formatDate } from '@/utils/format';
import { inRange } from '@/utils/dateRange';
import { cn } from '@/lib/utils';
import type { Booking, PaymentStatus } from '@/types';

function bookingPending(b: Booking) {
  return bookingPendingAmount(b);
}

function bookingStatus(b: Booking): PaymentStatus {
  const { grandTotal, paid } = bookingPendingBreakdown(b);
  return calculatePaymentStatus(grandTotal, paid, b.checkOutDate);
}

export default function PendingPaymentsPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const [filter, setFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const { range, resetKey, filterProps } = useDateRange('month');

  const allWithBalance = useMemo(
    () =>
      bookings.filter(
        (b) =>
          bookingPending(b) > 0 &&
          b.status !== 'Cancelled' &&
          b.status !== 'No Show' &&
          inRange(b.checkInDate, range),
      ),
    [bookings, range],
  );

  const pending = useMemo(() => {
    return allWithBalance
      .map((b) => ({ booking: b, status: bookingStatus(b), pending: bookingPending(b) }))
      .filter((row) => (filter === 'ALL' ? true : row.status === filter))
      .sort((a, b) => b.pending - a.pending);
  }, [allWithBalance, filter]);

  const { page, setPage, pageItems, total: pageTotal } = usePagination(
    pending,
    `${resetKey}|${filter}`,
  );

  const totalPending = round2(allWithBalance.reduce((s, b) => s + bookingPending(b), 0));
  const overdue = allWithBalance.filter((b) => bookingStatus(b) === 'OVERDUE');
  const overdueAmount = round2(overdue.reduce((s, b) => s + bookingPending(b), 0));

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pending Payments"
        description="Outstanding room rent and extra charges from bookings."
        actions={
          <div className="flex flex-wrap gap-2">
            <DateRangeFilter {...filterProps} />
            <Select value={filter} onValueChange={(v) => setFilter(v as PaymentStatus | 'ALL')}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Pending</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Total Pending
          </p>
          <p className="mt-1 text-2xl font-semibold text-warning">
            <Money value={totalPending} muteZero={false} />
          </p>
        </Card>
        <Card className="border-destructive/30 p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Overdue Amount
          </p>
          <p className="mt-1 text-2xl font-semibold text-destructive">
            <Money value={overdueAmount} muteZero={false} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Overdue Count</p>
          <p className="mt-1 text-2xl font-semibold">{overdue.length}</p>
        </Card>
      </div>

      {pending.length === 0 ? (
        <EmptyState title="No pending payments from bookings" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-center">Room</TableHead>
                  <TableHead>Stay</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Extras Due</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map(({ booking: b, status, pending: due }) => {
                  const breakdown = bookingPendingBreakdown(b);
                  return (
                  <TableRow
                    key={b.id}
                    className={cn(
                      (status === 'PENDING' || status === 'OVERDUE') && 'bg-destructive/5',
                    )}
                  >
                    <TableCell className="whitespace-nowrap">{formatDate(b.checkInDate)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{b.guestName}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.mobile && b.mobile !== '—' ? b.mobile : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{b.roomNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(b.checkInDate, 'DD MMM')} → {formatDate(b.checkOutDate, 'DD MMM')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={breakdown.grandTotal} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={breakdown.paid} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={breakdown.extrasPending} colored={breakdown.extrasPending > 0} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={due} colored />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                        <Link to={`/bookings/${b.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={page} total={pageTotal} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
