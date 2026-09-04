import { appDay, appNow } from '@/lib/dayjs';
import type { Booking, Room } from '@/types';

export type BoardStatus = 'Available' | 'Occupied' | 'Reserved';

export interface RoomOccupancy {
  room: Room;
  status: BoardStatus;
  booking?: Booking;
}

export function deriveRoomStatus(room: Room, bookings: Booking[]): RoomOccupancy {
  const today = appNow();

  const occupied = bookings.find(
    (b) =>
      b.roomId === room.id &&
      b.status === 'Checked In' &&
      today.isAfter(appDay(b.checkInDate).startOf('day').subtract(1, 'second')) &&
      today.isBefore(appDay(b.checkOutDate).endOf('day')),
  );
  if (occupied) return { room, status: 'Occupied', booking: occupied };

  const reserved = bookings.find(
    (b) =>
      b.roomId === room.id &&
      b.status === 'Reserved' &&
      today.isBefore(appDay(b.checkOutDate).endOf('day')),
  );
  if (reserved) return { room, status: 'Reserved', booking: reserved };

  return { room, status: 'Available' };
}
