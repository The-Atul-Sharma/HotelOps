import { useMemo } from 'react';
import dayjs from 'dayjs';
import {
  useRooms,
  useBookings,
  useAdvances,
  useExpenses,
} from '@/hooks/useEntities';
import { PAYMENT_MODES } from '@/config/constants';
import { inRange } from '@/utils/dateRange';
import {
  bookingExtrasIncome,
  bookingRoomIncome,
  bookingTotalIncome,
  calculatePaymentStatus,
  round2,
} from '@/utils/finance';
import type { Booking, BookingPayment, DateRange } from '@/types';
import { deriveRoomStatus } from '@/features/rooms/occupancy';

function isActiveBooking(b: Booking) {
  return b.status !== 'Cancelled' && b.status !== 'No Show';
}

function bookingPending(b: Booking) {
  return Math.max(b.balanceAmount, 0);
}

function bookingPayments(b: Booking): BookingPayment[] {
  if (b.payments?.length) return b.payments;
  if (b.paidAmount > 0) {
    return [
      {
        id: `${b.id}-legacy`,
        amount: b.paidAmount,
        mode: b.paymentMode,
        date: b.checkInDate,
        note: 'Payment',
      },
    ];
  }
  return [];
}

export function useDashboardData(range: DateRange) {
  const { data: rooms = [], isLoading: rLoad } = useRooms();
  const { data: bookings = [], isLoading: bLoad } = useBookings();
  const { data: expenses = [], isLoading: eLoad } = useExpenses();
  const { data: advances = [], isLoading: aLoad } = useAdvances();

  return useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const activeBookings = bookings.filter(isActiveBooking);

    const incomeBookings = activeBookings.filter((b) => inRange(b.checkInDate, range));
    const totalRevenue = round2(incomeBookings.reduce((s, b) => s + bookingTotalIncome(b), 0));
    const roomTariff = round2(incomeBookings.reduce((s, b) => s + bookingRoomIncome(b), 0));
    const extrasTotal = round2(incomeBookings.reduce((s, b) => s + bookingExtrasIncome(b), 0));

    const paymentsInRange: { booking: Booking; payment: BookingPayment }[] = [];
    for (const b of activeBookings) {
      for (const payment of bookingPayments(b)) {
        if (inRange(payment.date, range)) {
          paymentsInRange.push({ booking: b, payment });
        }
      }
    }
    const collected = round2(paymentsInRange.reduce((s, r) => s + r.payment.amount, 0));

    const expensesInRange = expenses.filter((e) => inRange(e.date, range));
    const totalExpenses = round2(expensesInRange.reduce((s, e) => s + e.amount, 0));
    const netProfit = round2(totalRevenue - totalExpenses);

    const pendingBookings = activeBookings.filter(
      (b) => bookingPending(b) > 0 && inRange(b.checkInDate, range),
    );
    const pending = round2(pendingBookings.reduce((s, b) => s + bookingPending(b), 0));
    const overdueBookings = pendingBookings.filter(
      (b) => calculatePaymentStatus(b.totalAmount, b.paidAmount, b.checkOutDate) === 'OVERDUE',
    );
    const overdueAmount = round2(overdueBookings.reduce((s, b) => s + bookingPending(b), 0));

    const advancesInRange = advances.filter((a) => inRange(a.date, range));
    const advancesGiven = round2(advancesInRange.reduce((s, a) => s + a.amount, 0));

    const todayCollection = round2(
      activeBookings.reduce((sum, b) => {
        return (
          sum +
          bookingPayments(b)
            .filter((p) => dayjs(p.date).format('YYYY-MM-DD') === todayStr)
            .reduce((s, p) => s + p.amount, 0)
        );
      }, 0),
    );

    const todayExpenses = round2(
      expenses
        .filter((e) => dayjs(e.date).format('YYYY-MM-DD') === todayStr)
        .reduce((s, e) => s + e.amount, 0),
    );

    const board = rooms.map((r) => deriveRoomStatus(r, bookings));
    const occupied = board.filter((x) => x.status === 'Occupied').length;
    const available = board.filter((x) => x.status === 'Available').length;
    const reserved = board.filter((x) => x.status === 'Reserved').length;

    const todayCheckIns = activeBookings.filter(
      (b) => dayjs(b.checkInDate).format('YYYY-MM-DD') === todayStr,
    ).length;
    const todayCheckOuts = activeBookings.filter(
      (b) => dayjs(b.checkOutDate).format('YYYY-MM-DD') === todayStr,
    ).length;

    const kpis = {
      totalRevenue,
      roomTariff,
      extrasTotal,
      collected,
      totalExpenses,
      netProfit,
      pending,
      advancesGiven,
      todayCollection,
      todayExpenses,
      occupied,
      available,
      reserved,
      todayCheckIns,
      todayCheckOuts,
    };

    const byDay = new Map<string, { sort: string; revenue: number; expense: number }>();
    for (const b of incomeBookings) {
      const sort = dayjs(b.checkInDate).format('YYYY-MM-DD');
      const label = dayjs(b.checkInDate).format('DD MMM');
      const entry = byDay.get(label) ?? { sort, revenue: 0, expense: 0 };
      entry.revenue += bookingTotalIncome(b);
      byDay.set(label, entry);
    }
    for (const e of expensesInRange) {
      const sort = dayjs(e.date).format('YYYY-MM-DD');
      const label = dayjs(e.date).format('DD MMM');
      const entry = byDay.get(label) ?? { sort, revenue: 0, expense: 0 };
      entry.expense += e.amount;
      entry.sort = sort;
      byDay.set(label, entry);
    }
    const revenueExpense = Array.from(byDay.entries())
      .sort((a, b) => a[1].sort.localeCompare(b[1].sort))
      .map(([label, v]) => ({
        label,
        revenue: round2(v.revenue),
        expense: round2(v.expense),
      }));

    const revenueByCategory = [
      { name: 'Room Tariff', value: roomTariff },
      { name: 'Extra Charges', value: extrasTotal },
    ].filter((d) => d.value > 0);

    const modeMap: Record<string, number> = {};
    for (const m of PAYMENT_MODES) modeMap[m] = 0;
    for (const row of paymentsInRange) {
      modeMap[row.payment.mode] = round2(
        (modeMap[row.payment.mode] ?? 0) + row.payment.amount,
      );
    }
    const paymentMethods = PAYMENT_MODES.map((name) => ({
      name,
      value: modeMap[name] ?? 0,
    })).filter((d) => d.value > 0);

    const occupancy = [
      { name: 'Occupied', value: occupied },
      { name: 'Available', value: available },
      { name: 'Reserved', value: reserved },
    ];

    const monthMap = new Map<string, { sort: string; income: number; expense: number }>();
    for (const b of activeBookings) {
      if (!inRange(b.checkInDate, range)) continue;
      const sort = dayjs(b.checkInDate).format('YYYY-MM');
      const label = dayjs(b.checkInDate).format('MMM YY');
      const entry = monthMap.get(label) ?? { sort, income: 0, expense: 0 };
      entry.income += bookingTotalIncome(b);
      monthMap.set(label, entry);
    }
    for (const e of expensesInRange) {
      const sort = dayjs(e.date).format('YYYY-MM');
      const label = dayjs(e.date).format('MMM YY');
      const entry = monthMap.get(label) ?? { sort, income: 0, expense: 0 };
      entry.expense += e.amount;
      entry.sort = sort;
      monthMap.set(label, entry);
    }
    const monthlyProfit = Array.from(monthMap.entries())
      .sort((a, b) => a[1].sort.localeCompare(b[1].sort))
      .map(([label, v]) => ({
        label,
        income: round2(v.income),
        expense: round2(v.expense),
        profit: round2(v.income - v.expense),
      }));

    const pendingChart = pendingBookings
      .map((b) => ({
        name: b.guestName.slice(0, 14),
        paid: round2(b.paidAmount),
        pending: round2(bookingPending(b)),
      }))
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 6);

    return {
      isLoading: rLoad || bLoad || eLoad || aLoad,
      kpis,
      revenueExpense,
      revenueByCategory,
      paymentMethods,
      occupancy,
      monthlyProfit,
      pendingChart,
      overdueCount: overdueBookings.length,
      overdueAmount,
      todayBookings: todayCheckIns,
    };
  }, [rooms, bookings, expenses, advances, range, rLoad, bLoad, eLoad, aLoad]);
}
