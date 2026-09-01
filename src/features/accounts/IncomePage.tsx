import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Eye, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { PaginationBar } from "@/components/shared/Pagination";
import { Money } from "@/components/shared/Money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBookings } from "@/hooks/useEntities";
import { usePagination } from "@/hooks/usePagination";
import { useDateRange } from "@/hooks/useDateRange";
import { round2, bookingRoomIncome, bookingExtrasIncome, bookingTotalIncome } from "@/utils/finance";
import { formatDate } from "@/utils/format";
import { inRange } from "@/utils/dateRange";

export default function IncomePage() {
  const { data: bookings = [], isLoading } = useBookings();
  const { range, resetKey, filterProps } = useDateRange("month");

  const rows = useMemo(() => {
    return bookings
      .filter((b) => b.status !== "Cancelled" && b.status !== "No Show")
      .filter((b) => inRange(b.checkInDate, range))
      .map((b) => ({
        booking: b,
        room: bookingRoomIncome(b),
        extras: bookingExtrasIncome(b),
        total: bookingTotalIncome(b),
      }))
      .filter((r) => r.total > 0)
      .sort(
        (a, b) =>
          new Date(b.booking.checkInDate).getTime() -
          new Date(a.booking.checkInDate).getTime(),
      );
  }, [bookings, range]);

  const { page, setPage, pageItems, total: pageTotal } = usePagination(
    rows,
    resetKey,
  );

  const roomTotal = round2(rows.reduce((s, r) => s + r.room, 0));
  const extrasTotal = round2(rows.reduce((s, r) => s + r.extras, 0));
  const total = round2(roomTotal + extrasTotal);
  const collected = round2(rows.reduce((s, r) => s + r.booking.paidAmount, 0));

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Income"
        description="Revenue from bookings — room tariff and extra charges."
        actions={<DateRangeFilter {...filterProps} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Income</p>
          <p className="mt-1 flex items-center gap-1.5 text-xl font-semibold text-success">
            <TrendingUp className="h-4 w-4" />
            <Money value={total} muteZero={false} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Room Tariff</p>
          <p className="mt-1 text-xl font-semibold">
            <Money value={roomTotal} muteZero={false} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Extra Charges</p>
          <p className="mt-1 text-xl font-semibold">
            <Money value={extrasTotal} muteZero={false} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="mt-1 text-xl font-semibold">
            <Money value={collected} muteZero={false} />
          </p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No income in this range" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-center">Room</TableHead>
                  <TableHead className="text-right">Room Tariff</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map(({ booking: b, room, extras, total: rowTotal }) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(b.checkInDate)}
                    </TableCell>
                    <TableCell className="font-medium">{b.guestName}</TableCell>
                    <TableCell className="text-center">{b.roomNumber}</TableCell>
                    <TableCell className="text-right">
                      <Money value={room} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={extras} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={rowTotal} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={b.paidAmount} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                        <Link to={`/bookings/${b.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={page} total={pageTotal} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
