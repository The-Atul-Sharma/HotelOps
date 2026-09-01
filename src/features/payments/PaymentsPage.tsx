import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Wallet } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBookings } from "@/hooks/useEntities";
import { usePagination } from "@/hooks/usePagination";
import { useDateRange } from "@/hooks/useDateRange";
import { PAYMENT_MODES } from "@/config/constants";
import { round2 } from "@/utils/finance";
import { formatDate } from "@/utils/format";
import { inRange } from "@/utils/dateRange";
import type { Booking, BookingPayment, PaymentMode } from "@/types";

type PaymentRow = {
  id: string;
  booking: Booking;
  payment: BookingPayment;
};

function bookingPayments(b: Booking): BookingPayment[] {
  if (b.payments?.length) return b.payments;
  if (b.paidAmount > 0) {
    return [
      {
        id: `${b.id}-legacy`,
        amount: b.paidAmount,
        mode: b.paymentMode,
        date: b.checkInDate,
        note: "Payment",
      },
    ];
  }
  return [];
}

export default function PaymentsPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const { range, resetKey, filterProps } = useDateRange("month");
  const [modeFilter, setModeFilter] = useState<PaymentMode | "ALL">("ALL");

  const rows = useMemo(() => {
    const list: PaymentRow[] = [];
    for (const b of bookings) {
      if (b.status === "Cancelled" || b.status === "No Show") continue;
      for (const payment of bookingPayments(b)) {
        if (!inRange(payment.date, range)) continue;
        if (modeFilter !== "ALL" && payment.mode !== modeFilter) continue;
        list.push({ id: `${b.id}-${payment.id}`, booking: b, payment });
      }
    }
    return list.sort(
      (a, b) =>
        new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime() ||
        b.payment.amount - a.payment.amount,
    );
  }, [bookings, range, modeFilter]);

  const { page, setPage, pageItems, total: pageTotal } = usePagination(
    rows,
    `${resetKey}|${modeFilter}`,
  );

  const modeTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of PAYMENT_MODES) map[m] = 0;
    for (const row of rows) {
      map[row.payment.mode] = round2(
        (map[row.payment.mode] ?? 0) + row.payment.amount,
      );
    }
    return map;
  }, [rows]);

  const totalCollected = round2(rows.reduce((s, r) => s + r.payment.amount, 0));

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Collections from bookings by payment mode."
        actions={
          <div className="flex flex-wrap gap-2">
            <DateRangeFilter {...filterProps} />
            <Select
              value={modeFilter}
              onValueChange={(v) => setModeFilter(v as PaymentMode | "ALL")}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Modes</SelectItem>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Total Collected
          </p>
          <p className="mt-1 text-xl font-semibold text-success">
            <Money value={totalCollected} muteZero={false} />
          </p>
        </Card>
        {PAYMENT_MODES.filter((m) => m !== "Bank Transfer" && m !== "Other").map(
          (m) => (
            <Card key={m} className="p-4">
              <p className="text-xs text-muted-foreground">{m}</p>
              <p className="mt-1 text-xl font-semibold">
                <Money value={modeTotals[m] ?? 0} muteZero={false} />
              </p>
            </Card>
          ),
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No payments in this range" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-center">Room</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map(({ id, booking: b, payment: p }) => (
                  <TableRow key={id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(p.date)}
                    </TableCell>
                    <TableCell className="font-medium">{b.guestName}</TableCell>
                    <TableCell className="text-center">{b.roomNumber}</TableCell>
                    <TableCell>{p.mode}</TableCell>
                    <TableCell>{!p.account || p.account === "None" ? "—" : p.account}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.note || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={p.amount} />
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
