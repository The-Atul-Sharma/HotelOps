import { useMemo, useState } from "react";
import { Printer, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/states";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { PaginationBar } from "@/components/shared/Pagination";
import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExpenses, useBookings, useAdvances } from "@/hooks/useEntities";
import { usePagination } from "@/hooks/usePagination";
import { useDateRange } from "@/hooks/useDateRange";
import { inRange } from "@/utils/dateRange";
import {
  bookingExtrasIncome,
  bookingPendingAmount,
  bookingPendingBreakdown,
  bookingRoomIncome,
  bookingTotalIncome,
  calculatePaymentStatus,
  computeAccountBalances,
  isActiveBooking,
  paymentCollectionBucket,
  resolveBookingPayments,
  round2,
} from "@/utils/finance";
import { exportToExcel } from "@/utils/excel";
import { formatDate } from "@/utils/format";
import { ACCOUNT_BALANCE_FROM, ACCOUNT_BALANCE_MESSAGE } from "@/config/constants";
import { AccountBalanceChart } from "@/features/dashboard/charts";
import type { Advance, Booking, BookingPayment, DateRange, Expense } from "@/types";

const REPORTS = [
  "Daily Collection",
  "Daily Profit",
  "Monthly Profit & Loss",
  "Pending Payments",
  "Room Revenue",
  "Extra Charges",
  "Account Balance",
  "STF",
] as const;
type ReportType = (typeof REPORTS)[number];

type PaymentRow = { booking: Booking; payment: BookingPayment };

function collectPayments(bookings: Booking[], range: DateRange): PaymentRow[] {
  const rows: PaymentRow[] = [];
  for (const b of bookings) {
    if (!isActiveBooking(b)) continue;
    for (const payment of resolveBookingPayments(b)) {
      if (inRange(payment.date, range)) {
        rows.push({ booking: b, payment });
      }
    }
  }
  return rows;
}

function bookingPending(b: Booking) {
  return bookingPendingAmount(b);
}

export default function ReportsPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: expenses = [] } = useExpenses();
  const { data: advances = [] } = useAdvances();
  const { range, resetKey, filterProps } = useDateRange("month");
  const [report, setReport] = useState<ReportType>("Daily Profit");

  const scopedExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.date, range)),
    [expenses, range],
  );

  const paymentRows = useMemo(
    () => collectPayments(bookings, range),
    [bookings, range],
  );

  const incomeBookings = useMemo(
    () =>
      bookings.filter(
        (b) => isActiveBooking(b) && inRange(b.checkInDate, range),
      ),
    [bookings, range],
  );

  const { rows, columns, summary, chartData, subtitle } = useMemo(
    () =>
      buildReport(
        report,
        paymentRows,
        incomeBookings,
        bookings,
        scopedExpenses,
        expenses,
        advances,
        range,
      ),
    [report, paymentRows, incomeBookings, bookings, scopedExpenses, expenses, advances, range],
  );

  const { page, setPage, pageItems, total: pageTotal } = usePagination(
    rows,
    `${report}|${resetKey}`,
  );

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Financial and operational reports with export."
        actions={
          <div className="flex flex-wrap gap-2">
            {report !== "Account Balance" && <DateRangeFilter {...filterProps} />}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportToExcel(rows, `${report}`)}
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r}
            onClick={() => setReport(r)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${report === r ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            {r}
          </button>
        ))}
      </div>

      {report === "Account Balance" && (
        <p className="rounded-lg border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          {ACCOUNT_BALANCE_MESSAGE} · money received minus expenses and advances per account
        </p>
      )}

      {summary.length > 0 && (
        <div
          className={`grid gap-3 ${report === "Account Balance" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}
        >
          {summary.map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-lg font-semibold ${s.tone ?? ""}`}>
                <Money value={s.value} muteZero={false} />
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{report}</CardTitle>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {chartData && chartData.length > 0 && (
            <AccountBalanceChart data={chartData} />
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead
                      key={c.key}
                      className={c.align === "right" ? "text-right" : ""}
                    >
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No data for this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((c) => (
                        <TableCell
                          key={c.key}
                          className={
                            c.align === "right" ? "text-right tabular-nums" : ""
                          }
                        >
                          {c.money ? (
                            <Money value={Number(row[c.key]) || 0} />
                          ) : (
                            String(row[c.key] ?? "")
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={page} total={pageTotal} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}

interface Column {
  key: string;
  label: string;
  align?: "right";
  money?: boolean;
}

function emptyCollection() {
  return { cash: 0, online: 0, upi: 0, card: 0 };
}

function addPaymentToCollection(
  entry: ReturnType<typeof emptyCollection>,
  payment: BookingPayment,
) {
  const bucket = paymentCollectionBucket(payment.mode);
  if (!bucket) return;
  entry[bucket] = round2(entry[bucket] + payment.amount);
}

function collectionTotals(payments: PaymentRow[]) {
  const totals = emptyCollection();
  for (const { payment } of payments) {
    addPaymentToCollection(totals, payment);
  }
  return totals;
}

function buildReport(
  report: ReportType,
  paymentRows: PaymentRow[],
  incomeBookings: Booking[],
  bookings: Booking[],
  expenses: Expense[],
  allExpenses: Expense[],
  allAdvances: Advance[],
  range: DateRange,
): {
  rows: Record<string, unknown>[];
  columns: Column[];
  summary: { label: string; value: number; tone?: string }[];
  chartData?: { name: string; value: number }[];
  subtitle?: string;
} {
  const totals = collectionTotals(paymentRows);
  const totalRevenue = round2(
    incomeBookings.reduce((s, b) => s + bookingTotalIncome(b), 0),
  );
  const totalExpenses = round2(expenses.reduce((s, e) => s + e.amount, 0));
  const netProfit = round2(totalRevenue - totalExpenses);
  const totalPending = round2(
    bookings
      .filter(
        (b) =>
          isActiveBooking(b) &&
          bookingPending(b) > 0 &&
          inRange(b.checkInDate, range),
      )
      .reduce((s, b) => s + bookingPending(b), 0),
  );

  switch (report) {
    case "Daily Collection": {
      const map = new Map<string, ReturnType<typeof emptyCollection>>();
      for (const { payment } of paymentRows) {
        const date = payment.date.slice(0, 10);
        const entry = map.get(date) ?? emptyCollection();
        addPaymentToCollection(entry, payment);
        map.set(date, entry);
      }
      const rows = Array.from(map.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, v]) => ({
          Date: formatDate(date),
          Cash: round2(v.cash),
          Online: round2(v.online),
          UPI: round2(v.upi),
          Card: round2(v.card),
          Total: round2(v.cash + v.online + v.upi + v.card),
        }));
      return {
        rows,
        columns: [
          { key: "Date", label: "Date" },
          { key: "Cash", label: "Cash", align: "right", money: true },
          { key: "Online", label: "Online", align: "right", money: true },
          { key: "UPI", label: "UPI", align: "right", money: true },
          { key: "Card", label: "Card", align: "right", money: true },
          { key: "Total", label: "Total", align: "right", money: true },
        ],
        summary: [
          { label: "Cash", value: totals.cash },
          { label: "Online", value: totals.online },
          { label: "UPI", value: totals.upi },
          { label: "Card", value: totals.card },
        ],
      };
    }
    case "Daily Profit": {
      const map = new Map<string, { income: number; expense: number }>();
      for (const b of incomeBookings) {
        const date = b.checkInDate.slice(0, 10);
        const entry = map.get(date) ?? { income: 0, expense: 0 };
        entry.income += bookingTotalIncome(b);
        map.set(date, entry);
      }
      for (const e of expenses) {
        const date = e.date.slice(0, 10);
        const entry = map.get(date) ?? { income: 0, expense: 0 };
        entry.expense += e.amount;
        map.set(date, entry);
      }
      const rows = Array.from(map.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, v]) => ({
          Date: formatDate(date),
          Income: round2(v.income),
          Expense: round2(v.expense),
          Profit: round2(v.income - v.expense),
        }));
      return {
        rows,
        columns: [
          { key: "Date", label: "Date" },
          { key: "Income", label: "Income", align: "right", money: true },
          { key: "Expense", label: "Expense", align: "right", money: true },
          { key: "Profit", label: "Profit", align: "right", money: true },
        ],
        summary: [
          {
            label: "Total Income",
            value: totalRevenue,
            tone: "text-success",
          },
          {
            label: "Total Expense",
            value: totalExpenses,
            tone: "text-destructive",
          },
          {
            label: "Net Profit",
            value: netProfit,
            tone: "text-primary",
          },
        ],
      };
    }
    case "Monthly Profit & Loss": {
      const map = new Map<string, { income: number; expense: number }>();
      for (const b of incomeBookings) {
        const key = b.checkInDate.slice(0, 7);
        const entry = map.get(key) ?? { income: 0, expense: 0 };
        entry.income += bookingTotalIncome(b);
        map.set(key, entry);
      }
      for (const e of expenses) {
        const key = e.date.slice(0, 7);
        const entry = map.get(key) ?? { income: 0, expense: 0 };
        entry.expense += e.amount;
        map.set(key, entry);
      }
      const rows = Array.from(map.entries()).map(([month, v]) => ({
        Month: month,
        Income: round2(v.income),
        Expense: round2(v.expense),
        Profit: round2(v.income - v.expense),
      }));
      return {
        rows,
        columns: [
          { key: "Month", label: "Month" },
          { key: "Income", label: "Income", align: "right", money: true },
          { key: "Expense", label: "Expense", align: "right", money: true },
          { key: "Profit", label: "Profit", align: "right", money: true },
        ],
        summary: [
          {
            label: "Total Income",
            value: totalRevenue,
            tone: "text-success",
          },
          {
            label: "Total Expense",
            value: totalExpenses,
            tone: "text-destructive",
          },
          {
            label: "Net Profit",
            value: netProfit,
            tone: "text-primary",
          },
        ],
      };
    }
    case "Pending Payments": {
      const rows = bookings
        .filter(
          (b) =>
            isActiveBooking(b) &&
            bookingPending(b) > 0 &&
            inRange(b.checkInDate, range),
        )
        .map((b) => {
          const breakdown = bookingPendingBreakdown(b);
          return {
          Date: formatDate(b.checkInDate),
          Guest: b.guestName || "—",
          Room: b.roomNumber || "—",
          Total: breakdown.grandTotal,
          Paid: breakdown.paid,
          "Extras Due": breakdown.extrasPending,
          Pending: bookingPending(b),
          Status: calculatePaymentStatus(
            breakdown.grandTotal,
            breakdown.paid,
            b.checkOutDate,
          ),
        };
        });
      return {
        rows,
        columns: [
          { key: "Date", label: "Date" },
          { key: "Guest", label: "Guest" },
          { key: "Room", label: "Room" },
          { key: "Total", label: "Total", align: "right", money: true },
          { key: "Paid", label: "Paid", align: "right", money: true },
          { key: "Extras Due", label: "Extras Due", align: "right", money: true },
          { key: "Pending", label: "Pending", align: "right", money: true },
          { key: "Status", label: "Status" },
        ],
        summary: [
          {
            label: "Total Pending",
            value: totalPending,
            tone: "text-warning",
          },
        ],
      };
    }
    case "Room Revenue": {
      const map = new Map<string, { rent: number; extras: number }>();
      for (const b of incomeBookings) {
        if (!b.roomNumber) continue;
        const entry = map.get(b.roomNumber) ?? { rent: 0, extras: 0 };
        entry.rent += bookingRoomIncome(b);
        entry.extras += bookingExtrasIncome(b);
        map.set(b.roomNumber, entry);
      }
      const rows = Array.from(map.entries())
        .sort((a, b) => b[1].rent + b[1].extras - (a[1].rent + a[1].extras))
        .map(([room, v]) => ({
          Room: room,
          "Room Rent": round2(v.rent),
          Extras: round2(v.extras),
          Revenue: round2(v.rent + v.extras),
        }));
      return {
        rows,
        columns: [
          { key: "Room", label: "Room" },
          { key: "Room Rent", label: "Room Rent", align: "right", money: true },
          { key: "Extras", label: "Extra Charges", align: "right", money: true },
          { key: "Revenue", label: "Revenue", align: "right", money: true },
        ],
        summary: [
          {
            label: "Room Rent",
            value: round2(
              incomeBookings.reduce((s, b) => s + bookingRoomIncome(b), 0),
            ),
          },
          {
            label: "Extra Charges",
            value: round2(
              incomeBookings.reduce((s, b) => s + bookingExtrasIncome(b), 0),
            ),
          },
        ],
      };
    }
    case "Extra Charges": {
      const active = bookings.filter(
        (b) =>
          isActiveBooking(b) &&
          inRange(b.checkInDate, range) &&
          bookingExtrasIncome(b) > 0,
      );
      const rows = active
        .sort(
          (a, b) =>
            new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime(),
        )
        .map((b) => ({
          Date: formatDate(b.checkInDate),
          Guest: b.guestName,
          Room: b.roomNumber,
          "Extra Charges": bookingExtrasIncome(b),
        }));
      const extrasTotal = round2(
        active.reduce((s, b) => s + bookingExtrasIncome(b), 0),
      );
      return {
        rows,
        columns: [
          { key: "Date", label: "Date" },
          { key: "Guest", label: "Guest" },
          { key: "Room", label: "Room" },
          {
            key: "Extra Charges",
            label: "Extra Charges",
            align: "right",
            money: true,
          },
        ],
        summary: [
          {
            label: "Extra Charges",
            value: extrasTotal,
            tone: "text-success",
          },
        ],
      };
    }
    case "Account Balance": {
      const abRange: DateRange = { from: ACCOUNT_BALANCE_FROM, to: range.to };
      const payments: BookingPayment[] = [];
      for (const b of bookings) {
        if (!isActiveBooking(b)) continue;
        for (const payment of resolveBookingPayments(b)) {
          if (inRange(payment.date, abRange)) payments.push(payment);
        }
      }
      const abExpenses = allExpenses.filter((e) => inRange(e.date, abRange));
      const abAdvances = allAdvances.filter((a) => inRange(a.date, abRange));
      const balances = computeAccountBalances(
        payments,
        abExpenses,
        abAdvances.map((a) => ({ ...a, account: a.account ?? "None" })),
      );
      const rows = balances.map((b) => ({
        Account: b.label,
        Received: b.income,
        Expenses: b.expense,
        Balance: b.balance,
      }));
      return {
        rows,
        columns: [
          { key: "Account", label: "Account" },
          { key: "Received", label: "Received", align: "right", money: true },
          { key: "Expenses", label: "Expenses", align: "right", money: true },
          { key: "Balance", label: "Balance", align: "right", money: true },
        ],
        summary: balances.map((b) => ({
          label: b.label,
          value: b.balance,
          tone: b.balance >= 0 ? "text-success" : "text-destructive",
        })),
        chartData: balances.map((b) => ({ name: b.label, value: b.balance })),
        subtitle: `${ACCOUNT_BALANCE_MESSAGE} · money received minus expenses and advances per account`,
      };
    }
    case "STF": {
      const stf = expenses
        .filter((e) => e.category === "STF")
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
      const total = round2(stf.reduce((s, e) => s + e.amount, 0));
      const rows = stf.map((e) => ({
        Date: formatDate(e.date),
        Person: e.description,
        Mode: e.paymentMode,
        Amount: e.amount,
        Remark: e.remarks || "—",
      }));
      return {
        rows,
        columns: [
          { key: "Date", label: "Date" },
          { key: "Person", label: "Person name" },
          { key: "Mode", label: "Payment Mode" },
          { key: "Amount", label: "Amount", align: "right", money: true },
          { key: "Remark", label: "Remark" },
        ],
        summary: [
          {
            label: "Total STF",
            value: total,
            tone: "text-success",
          },
        ],
      };
    }
  }
}
