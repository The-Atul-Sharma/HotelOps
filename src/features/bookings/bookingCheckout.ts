import dayjs from 'dayjs';
import type { Booking, BookingCharge, BookingPayment, HotelSettings, PaymentAccount, PaymentMode } from '@/types';
import { computeSplitBookingBill, isExtraChargePaid } from '@/utils/finance';

export function getBookingPayments(booking: Booking): BookingPayment[] {
  if (booking.payments?.length) return booking.payments;
  if (booking.paidAmount > 0) {
    return [
      {
        id: 'legacy-pay',
        amount: booking.paidAmount,
        mode: booking.paymentMode,
        date: booking.checkInDate,
        note: 'Payment',
      },
    ];
  }
  return [];
}

export function resolveTaxPercent(booking: Booking, settings?: HotelSettings | null): number {
  return booking.taxPercent > 0 ? booking.taxPercent : (settings?.taxPercent ?? 0);
}

export function getBookingBillState(booking: Booking, taxPercent: number) {
  const roomTotal = booking.roomAmount || booking.roomRate * booking.nights;
  const extraCharges = booking.extraCharges ?? [];
  const payments = getBookingPayments(booking);
  const bill = computeSplitBookingBill({
    roomAmount: roomTotal,
    extraCharges,
    foodAmount: booking.foodAmount,
    roomService: booking.roomService,
    discount: booking.discount,
    taxPercent,
    payments,
  });
  const pendingExtras = extraCharges.filter((c) => !isExtraChargePaid(c, payments));
  return {
    roomTotal,
    extraCharges,
    payments,
    bill,
    pendingExtras,
    balance: bill.roomBalance,
    grandTotal: bill.grandTotal,
  };
}

export function buildSettledExtras(
  booking: Booking,
  chargeIds: string[],
  modes?: Record<string, PaymentMode>,
  accounts?: Record<string, PaymentAccount>,
): { nextExtras: BookingCharge[]; nextPayments: BookingPayment[] } {
  const extraCharges = booking.extraCharges ?? [];
  const payments = getBookingPayments(booking);
  const idSet = new Set(chargeIds);
  const nextExtras = extraCharges.map((c) => {
    if (!idSet.has(c.id)) return c;
    const mode = modes?.[c.id] ?? c.paymentMode;
    const account = accounts?.[c.id] ?? c.account ?? 'None';
    return { ...c, paidAtOrder: true, paymentMode: mode, account };
  });
  const nextPayments = [...payments];
  for (const chargeId of chargeIds) {
    const charge = extraCharges.find((c) => c.id === chargeId);
    if (!charge || isExtraChargePaid(charge, payments)) continue;
    const mode = modes?.[chargeId] ?? charge.paymentMode;
    const account = accounts?.[chargeId] ?? charge.account ?? 'None';
    nextPayments.push({
      id: `pay-${charge.id}`,
      amount: charge.amount,
      mode,
      account,
      date: dayjs().format('YYYY-MM-DD'),
      note: charge.label,
    });
  }
  return { nextExtras, nextPayments };
}

export function buildCheckoutPatch(
  booking: Booking,
  taxPercent: number,
  extras: BookingCharge[],
  pmt: BookingPayment[],
) {
  const roomTotal = booking.roomAmount || booking.roomRate * booking.nights;
  const exitBill = computeSplitBookingBill({
    roomAmount: roomTotal,
    extraCharges: extras,
    foodAmount: booking.foodAmount,
    roomService: booking.roomService,
    discount: booking.discount,
    taxPercent,
    payments: pmt,
  });
  const lastMode = pmt.length > 0 ? pmt[pmt.length - 1].mode : booking.paymentMode;
  return {
    status: 'Checked Out' as const,
    taxPercent,
    taxAmount: exitBill.taxAmount,
    totalAmount: exitBill.grandTotal,
    paidAmount: exitBill.allPaid,
    balanceAmount: 0,
    otherCharges: exitBill.otherCharges,
    extraCharges: extras,
    payments: pmt,
    paymentMode: lastMode,
  };
}
