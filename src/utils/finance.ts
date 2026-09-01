import dayjs from 'dayjs';
import type {
  Booking,
  PaymentStatus,
  Transaction,
  Expense,
  Advance,
  BookingPayment,
} from '@/types';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const nights = dayjs(checkOut).diff(dayjs(checkIn), 'day');
  return Math.max(nights, 1);
}

export interface BookingTotalInput {
  roomRate: number;
  nights: number;
  foodAmount: number;
  roomService: number;
  otherCharges: number;
  discount: number;
  taxPercent: number;
}

export interface BookingTotalResult {
  roomAmount: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export function splitInclusiveGst(inclusiveAmount: number, taxPercent: number) {
  const inclusive = round2(Math.max(inclusiveAmount, 0));
  if (taxPercent <= 0) {
    return { taxable: inclusive, taxAmount: 0, inclusive };
  }
  const taxable = round2(inclusive / (1 + taxPercent / 100));
  const taxAmount = round2(inclusive - taxable);
  return { taxable, taxAmount, inclusive };
}

export function calculateBookingTotal(input: BookingTotalInput): BookingTotalResult {
  const roomInclusive = round2(input.roomRate * input.nights);
  const extras = input.foodAmount + input.roomService + input.otherCharges;
  const { taxable, taxAmount } = splitInclusiveGst(roomInclusive, input.taxPercent);
  const totalAmount = round2(Math.max(roomInclusive + extras - input.discount, 0));
  return { roomAmount: roomInclusive, subtotal: taxable, taxAmount, totalAmount };
}

export function sumExtraCharges(
  charges: { amount: number }[] | undefined | null,
): number {
  return round2((charges ?? []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0));
}

export function roomPaymentsOnly(
  payments: BookingPayment[],
  extraCharges: { id: string }[] | undefined | null,
): BookingPayment[] {
  const extraPaymentIds = new Set((extraCharges ?? []).map((c) => `pay-${c.id}`));
  return payments.filter((p) => !extraPaymentIds.has(p.id));
}

export function bookingRoomIncome(
  b: Pick<Booking, 'roomAmount' | 'roomRate' | 'nights'>,
): number {
  return round2(b.roomAmount || b.roomRate * b.nights || 0);
}

export function bookingExtrasIncome(
  b: Pick<Booking, 'roomService' | 'foodAmount' | 'otherCharges' | 'extraCharges'>,
): number {
  return round2(
    (Number(b.roomService) || 0) +
      (Number(b.foodAmount) || 0) +
      (Number(b.otherCharges) || 0) +
      sumExtraCharges(b.extraCharges),
  );
}

export function bookingTotalIncome(
  b: Pick<
    Booking,
    'roomAmount' | 'roomRate' | 'nights' | 'roomService' | 'foodAmount' | 'otherCharges' | 'extraCharges'
  >,
): number {
  return round2(bookingRoomIncome(b) + bookingExtrasIncome(b));
}

export function computeBookingBill(input: {
  roomAmount: number;
  extraCharges?: { amount: number }[] | null;
  foodAmount?: number;
  roomService?: number;
  discount?: number;
  taxPercent: number;
  paidAmount: number;
}) {
  const extras = sumExtraCharges(input.extraCharges);
  const food = input.foodAmount ?? 0;
  const service = input.roomService ?? 0;
  const discount = input.discount ?? 0;
  const roomInclusive = round2(Math.max(input.roomAmount - discount, 0));
  const { taxable, taxAmount, inclusive } = splitInclusiveGst(roomInclusive, input.taxPercent);
  const totalAmount = round2(inclusive + extras + food + service);
  return {
    otherCharges: extras,
    taxable,
    taxAmount,
    roomInclusive: inclusive,
    totalAmount,
    balanceAmount: calculatePendingAmount(totalAmount, input.paidAmount),
  };
}

export function calculatePendingAmount(totalAmount: number, paidAmount: number): number {
  return round2(Math.max(totalAmount - paidAmount, 0));
}

export function calculatePaymentStatus(
  totalAmount: number,
  paidAmount: number,
  dueDate?: string,
): PaymentStatus {
  const pending = calculatePendingAmount(totalAmount, paidAmount);
  if (totalAmount <= 0) return 'PAID';
  if (pending <= 0) return 'PAID';
  if (paidAmount > 0 && pending > 0) {
    if (dueDate && dayjs(dueDate).isBefore(dayjs(), 'day')) return 'OVERDUE';
    return 'PARTIAL';
  }
  if (paidAmount <= 0) {
    if (dueDate && dayjs(dueDate).isBefore(dayjs(), 'day')) return 'OVERDUE';
    return 'PENDING';
  }
  return 'PENDING';
}

export function isPendingStatus(status: PaymentStatus): boolean {
  return status === 'PENDING' || status === 'OVERDUE';
}

export function calculateAdvanceBalance(amount: number, recovered: number): number {
  return round2(Math.max(amount - recovered, 0));
}

export function sumPayments(payments: { amount: number }[] | undefined | null): number {
  return round2((payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
}

export function paymentsByMode(
  payments: { amount: number; mode: string }[] | undefined | null,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of payments ?? []) {
    map[p.mode] = round2((map[p.mode] ?? 0) + (Number(p.amount) || 0));
  }
  return map;
}

export function calculateBalance(booking: Pick<Booking, 'totalAmount' | 'paidAmount'>): number {
  return calculatePendingAmount(booking.totalAmount, booking.paidAmount);
}

export function transactionIncome(t: Transaction): number {
  if (t.voided) return 0;
  return round2(t.roomRent + t.roomService + t.foodKitchen + t.otherIncome);
}

export function transactionExpense(t: Transaction): number {
  if (t.voided) return 0;
  return round2(t.expense);
}

export function isCollectionTransaction(t: Transaction): boolean {
  return !t.voided && transactionIncome(t) > 0;
}

export function transactionCollection(t: Transaction): {
  cash: number;
  online: number;
  upi: number;
  card: number;
  total: number;
} {
  if (!isCollectionTransaction(t)) {
    return { cash: 0, online: 0, upi: 0, card: 0, total: 0 };
  }
  const cash = t.cash || 0;
  const online = t.online || 0;
  const upi = t.upi || 0;
  const card = t.card || 0;
  return {
    cash,
    online,
    upi,
    card,
    total: round2(cash + online + upi + card),
  };
}

export interface Totals {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  pending: number;
  advanceReceived: number;
  advanceGiven: number;
  cash: number;
  online: number;
  upi: number;
  card: number;
}

export function summarizeTransactions(transactions: Transaction[]): Totals {
  const active = transactions.filter((t) => !t.voided);
  const totalIncome = round2(active.reduce((s, t) => s + transactionIncome(t), 0));
  const totalExpense = round2(active.reduce((s, t) => s + t.expense, 0));
  const pending = round2(active.reduce((s, t) => s + t.pendingAmount, 0));
  const advanceReceived = round2(active.reduce((s, t) => s + t.advanceReceived, 0));
  const advanceGiven = round2(active.reduce((s, t) => s + t.advanceGiven, 0));
  const cash = round2(
    active.reduce((s, t) => s + transactionCollection(t).cash, 0),
  );
  const online = round2(
    active.reduce((s, t) => s + transactionCollection(t).online, 0),
  );
  const upi = round2(
    active.reduce((s, t) => s + transactionCollection(t).upi, 0),
  );
  const card = round2(
    active.reduce((s, t) => s + transactionCollection(t).card, 0),
  );
  return {
    totalIncome,
    totalExpense,
    netProfit: round2(totalIncome - totalExpense),
    pending,
    advanceReceived,
    advanceGiven,
    cash,
    online,
    upi,
    card,
  };
}

export function calculateProfit(income: number, expense: number): number {
  return round2(income - expense);
}

export function calculateDailyCollection(transactions: Transaction[], date: string): number {
  const target = dayjs(date).format('YYYY-MM-DD');
  return round2(
    transactions
      .filter((t) => dayjs(t.date).format('YYYY-MM-DD') === target)
      .reduce((s, t) => s + transactionCollection(t).total, 0),
  );
}

export function totalExpenses(expenses: Expense[]): number {
  return round2(expenses.reduce((s, e) => s + e.amount, 0));
}

export function totalAdvanceRemaining(advances: Advance[]): number {
  return round2(advances.reduce((s, a) => s + a.remainingAmount, 0));
}
