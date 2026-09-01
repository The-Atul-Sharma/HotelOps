import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, User, Settings2, CalendarPlus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, EmptyState } from '@/components/shared/states';
import { RoomStatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRooms, useBookings } from '@/hooks/useEntities';
import { deriveRoomStatus, type BoardStatus } from './occupancy';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/format';

const statusBar: Record<BoardStatus, string> = {
  Available: 'bg-success',
  Occupied: 'bg-primary',
  Reserved: 'bg-warning',
};

const ORDER: BoardStatus[] = ['Available', 'Occupied', 'Reserved'];

export default function RoomsPage() {
  const { data: rooms = [], isLoading } = useRooms();
  const { data: bookings = [] } = useBookings();
  const [filter, setFilter] = useState<BoardStatus | 'ALL'>('ALL');

  const board = useMemo(
    () =>
      rooms
        .map((r) => deriveRoomStatus(r, bookings))
        .sort((a, b) => a.room.number.localeCompare(b.room.number, undefined, { numeric: true })),
    [rooms, bookings],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { Total: board.length };
    ORDER.forEach((s) => (c[s] = board.filter((x) => x.status === s).length));
    return c;
  }, [board]);

  const filtered = filter === 'ALL' ? board : board.filter((x) => x.status === filter);

  if (isLoading) return <LoadingState label="Loading rooms…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rooms"
        description="Live occupancy board. Occupancy is driven by bookings; room numbers are configured in Settings."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-1.5">
              <Link to="/settings?tab=rooms">
                <Settings2 className="h-4 w-4" /> Configure Rooms
              </Link>
            </Button>
            <Button asChild className="gap-1.5">
              <Link to="/bookings">
                <CalendarPlus className="h-4 w-4" /> New Booking
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatChip label="Total" value={counts.Total} active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        {ORDER.map((s) => (
          <StatChip key={s} label={s} value={counts[s]} active={filter === s} onClick={() => setFilter(s)} />
        ))}
      </div>

      {board.length === 0 ? (
        <EmptyState
          title="No rooms configured"
          description="Add room numbers in Settings to see them here."
          icon={<BedDouble className="h-6 w-6" />}
          action={
            <Button asChild>
              <Link to="/settings?tab=rooms">Configure Rooms</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {filtered.map(({ room, status, booking }) => (
            <Card key={room.id} className="relative overflow-hidden p-0">
              <div className={cn('h-1.5 w-full', statusBar[status])} />
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold">Room {room.number}</p>
                    <p className="text-xs text-muted-foreground">Floor {room.floor}</p>
                  </div>
                  <RoomStatusBadge status={status} />
                </div>
                {booking && (status === 'Occupied' || status === 'Reserved') && (
                  <Link
                    to={`/bookings/${booking.id}`}
                    className="mt-3 block rounded-md bg-muted/60 p-2 text-xs transition-colors hover:bg-muted"
                  >
                    <p className="flex items-center gap-1 font-medium">
                      <User className="h-3 w-3" /> {booking.guestName}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{booking.code}</p>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2 text-left transition-colors',
        active ? 'border-primary bg-primary/5' : 'hover:bg-accent',
      )}
    >
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
    </button>
  );
}
