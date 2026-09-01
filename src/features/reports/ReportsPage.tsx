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
import {
  useTransactions,
  useExpenses,
  useBookings,
} from "@/hooks/useEntities";
import { usePagination } from "@/hooks/usePagination";
import { useDateRange } from "@/hooks/useDateRange";
import { inRange } from "@/utils/dateRange";
import {
  summarizeTransactions,
  transactionIncome,
  transactionCollection,
  round2,
  bookingExtrasIncome,
} from "@/utils/finance";
import { exportToExcel } from "@/utils/excel";
import { formatDate } from "@/utils/format";
import type { Booking, Expense, Transaction } from "@/types";

const REPORTS = [
  "Daily Collection",
  "Daily Profit",
  "Monthly Profit & Loss",
  "Pending Payments",
  "Room Revenue",
  "Extra Charges",
  "STF",
] as const;
type ReportType = (typeof REPORTS)[number];

export default function ReportsPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: bookings = [] } = useBookings();
  const { data: expenses = [] } = useExpenses();
  const { range, resetKey, filterProps } = useDateRange("month");
  const [report, setReport] = useState<ReportType>("Daily Profit");

  const scoped = useMemo(
    () => transactions.filter((t) => inRange(t.date, range) && !t.voided),
    [transactions, range],
  );
  const scopedExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.date, range)),
    [expenses, range],
  );

  const { rows, columns, summary } = useMemo(
    () => buildReport(report, scoped, bookings, scopedExpenses, range),
    [report, scoped, bookings, scopedExpenses, range],
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
            <DateRangeFilter {...filterProps} />
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

      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        </CardHeader>
        <CardContent className="space-y-3">
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

function buildReport(
  report: ReportType,
  scoped: Transaction[],
  bookings: Booking[],
  expenses: Expense[],
  range: { from: string; to: string },
): {
  rows: Record<string, unknown>[];
  columns: Column[];
  summary: { label: string; value: number; tone?: string }[];
} {
  const totals = summarizeTransactions(scoped);

  switch (report) {
    case "Daily Collection": {
      const map = new Map<
        string,
        { cash: number; online: number; upi: number; card: number }
      >();
      scoped.forEach((t) => {
        const c = transactionCollection(t);
        if (c.total <= 0) return;
        const e = map.get(t.date) ?? { cash: 0, online: 0, upi: 0, card: 0 };
        e.cash += c.cash;
        e.online += c.online;
        e.upi += c.upi;
        e.card += c.card;
        map.set(t.date, e);
      });
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
      scoped.forEach((t) => {
        const e = map.get(t.date) ?? { income: 0, expense: 0 };
        e.income += transactionIncome(t);
        e.expense += t.expense;
        map.set(t.date, e);
      });
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
            value: totals.totalIncome,
            tone: "text-success",
          },
          {
            label: "Total Expense",
            value: totals.totalExpense,
            tone: "text-destructive",
          },
          {
            label: "Net Profit",
            value: totals.netProfit,
            tone: "text-primary",
          },
        ],
      };
    }
    case "Monthly Profit & Loss": {
      const map = new Map<string, { income: number; expense: number }>();
      scoped.forEach((t) => {
        const key = t.date.slice(0, 7);
        const e = map.get(key) ?? { income: 0, expense: 0 };
        e.income += transactionIncome(t);
        e.expense += t.expense;
        map.set(key, e);
      });
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
            value: totals.totalIncome,
            tone: "text-success",
          },
          {
            label: "Total Expense",
            value: totals.totalExpense,
            tone: "text-destructive",
          },
          {
            label: "Net Profit",
            value: totals.netProfit,
            tone: "text-primary",
          },
        ],
      };
    }
    case "Pending Payments": {
      const rows = scoped
        .filter((t) => t.pendingAmount > 0)
        .map((t) => ({
          Date: formatDate(t.date),
          Guest: t.guest || t.party || "—",
          Room: t.roomNumber || "—",
          Total: t.totalAmount,
          Paid: t.paidAmount,
          Pending: t.pendingAmount,
          Status: t.paymentStatus,
        }));
      return {
        rows,
        columns: [
          { key: "Date", label: "Date" },
          { key: "Guest", label: "Guest" },
          { key: "Room", label: "Room" },
          { key: "Total", label: "Total", align: "right", money: true },
          { key: "Paid", label: "Paid", align: "right", money: true },
          { key: "Pending", label: "Pending", align: "right", money: true },
          { key: "Status", label: "Status" },
        ],
        summary: [
          {
            label: "Total Pending",
            value: totals.pending,
            tone: "text-warning",
          },
        ],
      };
    }
    case "Room Revenue": {
      const map = new Map<string, { rent: number; extras: number }>();
      scoped.forEach((t) => {
        if (!t.roomNumber) return;
        const e = map.get(t.roomNumber) ?? { rent: 0, extras: 0 };
        e.rent += t.roomRent;
        e.extras += t.roomService;
        map.set(t.roomNumber, e);
      });
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
            value: round2(scoped.reduce((s, t) => s + t.roomRent, 0)),
          },
          {
            label: "Extra Charges",
            value: round2(scoped.reduce((s, t) => s + t.roomService, 0)),
          },
        ],
      };
    }
    case "Extra Charges": {
      const active = bookings.filter(
        (b) =>
          b.status !== "Cancelled" &&
          b.status !== "No Show" &&
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
          "Room Service": b.roomService || 0,
          Food: b.foodAmount || 0,
          Other: round2(
            (b.otherCharges || 0) +
              (b.extraCharges || []).reduce((s, c) => s + c.amount, 0),
          ),
          Total: bookingExtrasIncome(b),
        }));
      const extrasTotal = round2(
        active.reduce((s, b) => s + bookingExtrasIncome(b), 0),
      );
      const roomServiceTotal = round2(
        active.reduce((s, b) => s + (b.roomService || 0), 0),
      );
      return {
        rows,
        columns: [
          { key: "Date", label: "Date" },
          { key: "Guest", label: "Guest" },
          { key: "Room", label: "Room" },
          {
            key: "Room Service",
            label: "Room Service",
            align: "right",
            money: true,
          },
          { key: "Food", label: "Food", align: "right", money: true },
          { key: "Other", label: "Other", align: "right", money: true },
          { key: "Total", label: "Total", align: "right", money: true },
        ],
        summary: [
          {
            label: "Extra Charges",
            value: extrasTotal,
            tone: "text-success",
          },
          {
            label: "Room Service",
            value: roomServiceTotal,
          },
        ],
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
