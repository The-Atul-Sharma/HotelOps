import { appDay } from '@/lib/dayjs';
import type { Booking, BookingCharge, ExtraChargeItemType } from '@/types';
import { round2 } from '@/utils/finance';
import { formatINR } from '@/utils/format';

export function extraChargeName(charge: BookingCharge): string {
  if (charge.itemType === 'Other') return charge.customName?.trim() || charge.label;
  if (charge.itemType) return charge.itemType;
  return charge.label;
}

export function formatExtraChargeLabel(charge: BookingCharge): string {
  const name = extraChargeName(charge);
  const qty = charge.quantity ?? 1;
  if (qty > 1) return `${name} × ${qty}`;
  return name;
}

export function formatExtraChargeDetail(charge: BookingCharge): string {
  const qty = charge.quantity ?? 1;
  const unitPrice = charge.unitPrice;
  if (unitPrice != null && qty > 0) {
    return qty > 1
      ? `${qty} × ${formatINR(unitPrice)} = ${formatINR(charge.amount)}`
      : formatINR(charge.amount);
  }
  return formatINR(charge.amount);
}

export interface GroupedExtraCharge {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

function extraChargeGroupKey(charge: BookingCharge): string {
  const name = extraChargeName(charge);
  const qty = charge.quantity ?? 1;
  const unitPrice =
    charge.unitPrice ?? (qty > 0 ? round2(charge.amount / qty) : charge.amount);
  if (charge.itemType === 'Other') {
    return `Other|${charge.customName?.trim() || name}|${unitPrice}`;
  }
  if (charge.itemType) {
    return `${charge.itemType}|${unitPrice}`;
  }
  return `${name}|${unitPrice}`;
}

export function groupExtraChargesForDisplay(
  charges: BookingCharge[],
): GroupedExtraCharge[] {
  const map = new Map<string, GroupedExtraCharge>();
  for (const charge of charges) {
    const key = extraChargeGroupKey(charge);
    const qty = charge.quantity ?? 1;
    const unitPrice =
      charge.unitPrice ?? (qty > 0 ? round2(charge.amount / qty) : charge.amount);
    const name = extraChargeName(charge);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += qty;
      existing.amount = round2(existing.amount + charge.amount);
    } else {
      map.set(key, { key, name, quantity: qty, unitPrice, amount: charge.amount });
    }
  }
  return Array.from(map.values());
}

export function formatGroupedExtraChargeLabel(
  group: Pick<GroupedExtraCharge, 'name' | 'quantity'>,
): string {
  if (group.quantity > 1) return `${group.name} × ${group.quantity}`;
  return group.name;
}

export function buildExtraCharge(input: {
  itemType: ExtraChargeItemType;
  customName: string;
  quantity: number;
  unitPrice: number;
  paymentMode: BookingCharge['paymentMode'];
  account?: BookingCharge['account'];
  paidAtOrder?: boolean;
  id?: string;
}): BookingCharge {
  const quantity = Math.max(input.quantity, 1);
  const amount = round2(quantity * input.unitPrice);
  const name =
    input.itemType === 'Other' ? input.customName.trim() : input.itemType;
  return {
    id: input.id ?? `xc-${Date.now()}`,
    label: formatExtraChargeLabel({
      id: '',
      label: name,
      amount,
      itemType: input.itemType,
      quantity,
      unitPrice: input.unitPrice,
      customName: input.itemType === 'Other' ? input.customName.trim() : undefined,
      paymentMode: input.paymentMode,
      account: input.account,
      paidAtOrder: input.paidAtOrder,
    }),
    amount,
    itemType: input.itemType,
    quantity,
    unitPrice: input.unitPrice,
    customName: input.itemType === 'Other' ? input.customName.trim() : undefined,
    paymentMode: input.paymentMode,
    account: input.account,
    paidAtOrder: input.paidAtOrder,
  };
}

export function recalculateExtraCharge(
  charge: BookingCharge,
  quantity: number,
  unitPrice: number,
): BookingCharge {
  const qty = Math.max(quantity, 1);
  const amount = round2(qty * unitPrice);
  const name = extraChargeName(charge);
  return {
    ...charge,
    quantity: qty,
    unitPrice,
    amount,
    label: formatExtraChargeLabel({
      ...charge,
      label: name,
      quantity: qty,
      unitPrice,
      amount,
    }),
  };
}

export function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return appDay(aStart).isBefore(appDay(bEnd)) && appDay(bStart).isBefore(appDay(aEnd));
}

export function hasConflict(
  bookings: Booking[],
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeId?: string,
): Booking | undefined {
  const blocking: Booking['status'][] = ['Reserved', 'Checked In'];
  return bookings.find(
    (b) =>
      b.id !== excludeId &&
      b.roomId === roomId &&
      blocking.includes(b.status) &&
      datesOverlap(checkIn, checkOut, b.checkInDate, b.checkOutDate),
  );
}
