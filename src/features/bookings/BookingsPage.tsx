import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, EmptyState } from '@/components/shared/states';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/shared/StatusBadge';
import { Money } from '@/components/shared/Money';
import { PaginationBar } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBookings } from '@/hooks/useEntities';
import { useDebounced } from '@/hooks/useDebounced';
import { usePagination } from '@/hooks/usePagination';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { BookingFormDialog } from './BookingFormDialog';
import { BookingCheckoutDialog } from './BookingCheckoutDialog';
import { calculatePaymentStatus, sumExtraCharges } from '@/utils/finance';
import { formatDate } from '@/utils/format';
import { inRange } from '@/utils/dateRange';
import { useDateRange } from '@/hooks/useDateRange';
import type { Booking, BookingStatus } from '@/types';

const FILTER_STATUSES: BookingStatus[] = [
  'Checked In',
  'Reserved',
  'Checked Out',
];

export default function BookingsPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);
  const [status, setStatus] = useState<BookingStatus | 'ALL'>('ALL');
  const { range, resetKey, filterProps } = useDateRange('month');
  const [formOpen, setFormOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | undefined>();
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | undefined>();

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return bookings
      .filter((b) => inRange(b.checkInDate, range))
      .filter((b) => (status === 'ALL' ? true : b.status === status))
      .filter((b) =>
        !q
          ? true
          : [b.guestName, b.mobile, b.roomNumber].some((v) =>
              String(v).toLowerCase().includes(q),
            ),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, debounced, status, range]);

  const { page, setPage, pageItems, total } = usePagination(
    filtered,
    `${resetKey}|${status}|${debounced}`,
  );
  const handleCheckout = (booking: Booking) => {
    setCheckoutBooking(booking);
  };

  if (isLoading) return <LoadingState label="Loading bookings…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bookings"
        description="Create bookings and check guests out from this list."
        actions={
          <Button
            onClick={() => {
              setEditBooking(undefined);
              setFormOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> New Booking
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by guest, mobile, room…"
            className="pl-8"
          />
        </div>
        <DateRangeFilter {...filterProps} />
        <Select value={status} onValueChange={(v) => setStatus(v as BookingStatus | 'ALL')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            {FILTER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No bookings found"
          action={<Button onClick={() => setFormOpen(true)}>Create booking</Button>}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-center">Guests</TableHead>
                  <TableHead className="text-center">Room</TableHead>
                  <TableHead>Stay</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{b.guestName}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.mobile && b.mobile !== '—' ? b.mobile : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{b.adults + b.children}</TableCell>
                    <TableCell className="text-center">{b.roomNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(b.checkInDate, 'DD MMM')} → {formatDate(b.checkOutDate, 'DD MMM')}
                      <span className="ml-1 text-xs text-muted-foreground">({b.nights}n)</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={sumExtraCharges(b.extraCharges)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={b.totalAmount} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={b.balanceAmount} colored />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={calculatePaymentStatus(b.totalAmount, b.paidAmount)} />
                    </TableCell>
                    <TableCell>
                      <BookingStatusBadge status={b.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {(b.status === 'Checked In' || b.status === 'Reserved') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => handleCheckout(b)}
                          >
                            <LogOut className="h-3.5 w-3.5" /> Checkout
                          </Button>
                        )}
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                          <Link to={`/bookings/${b.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditBooking(b);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={page} total={total} onPageChange={setPage} />
        </>
      )}

      <BookingFormDialog open={formOpen} onOpenChange={setFormOpen} booking={editBooking} />

      <BookingCheckoutDialog
        booking={checkoutBooking ?? null}
        open={checkoutBooking != null}
        onOpenChange={(open) => {
          if (!open) setCheckoutBooking(undefined);
        }}
      />
    </div>
  );
}
