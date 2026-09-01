import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useRooms, useBookings } from '@/hooks/useEntities';
import { formatINR } from '@/utils/format';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: rooms = [] } = useRooms();
  const { data: bookings = [] } = useBookings();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const results = useMemo(() => ({ rooms, bookings }), [rooms, bookings]);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-full justify-start gap-2 text-muted-foreground sm:w-64"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left text-sm">Search…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] sm:inline">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search rooms, bookings…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Rooms">
            {results.rooms.map((r) => (
              <CommandItem key={r.id} value={`room ${r.number} ${r.type}`} onSelect={() => go('/rooms')}>
                Room {r.number} · {r.type} · {r.status}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Bookings">
            {results.bookings.map((b) => (
              <CommandItem
                key={b.id}
                value={`booking ${b.code} ${b.guestName} ${b.roomNumber}`}
                onSelect={() => go(`/bookings/${b.id}`)}
              >
                {b.code} · {b.guestName} · Room {b.roomNumber} · {formatINR(b.totalAmount)}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
