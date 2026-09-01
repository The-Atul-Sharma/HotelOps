import dayjs from 'dayjs';
import type { Booking } from '@/types';

export function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return dayjs(aStart).isBefore(dayjs(bEnd)) && dayjs(bStart).isBefore(dayjs(aEnd));
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
