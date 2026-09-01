import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRooms, useBookings, roomHooks } from "@/hooks/useEntities";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import type { Room } from "@/types";

export function RoomsSettings() {
  const { data: rooms = [] } = useRooms();
  const { data: bookings = [] } = useBookings();
  const create = roomHooks.useCreate();
  const update = roomHooks.useUpdate();
  const remove = roomHooks.useRemove();
  const confirm = useConfirm();

  const [newNumber, setNewNumber] = useState("");
  const [newFloor, setNewFloor] = useState("1");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editFloor, setEditFloor] = useState("1");

  const sorted = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      ),
    [rooms],
  );

  const openEdit = (room: Room) => {
    setEditing(room);
    setEditNumber(room.number);
    setEditFloor(String(room.floor));
    setEditOpen(true);
  };

  const addRoom = () => {
    const roomNumber = newNumber.trim();
    const floor = Number(newFloor);
    if (!roomNumber) return toast.error("Room number is required");
    if (Number.isNaN(floor) || floor < 0)
      return toast.error("Enter a valid floor");
    if (
      rooms.some((r) => r.number.toLowerCase() === roomNumber.toLowerCase())
    ) {
      return toast.error(`Room ${roomNumber} already exists`);
    }

    create.mutate(
      {
        number: roomNumber,
        type: "Standard",
        floor,
        rate: 0,
        status: "Available",
        active: true,
      } as Omit<Room, "id" | "createdAt" | "updatedAt">,
      {
        onSuccess: () => {
          toast.success(`Room ${roomNumber} added`);
          setNewNumber("");
          setNewFloor("1");
        },
      },
    );
  };

  const saveEdit = () => {
    if (!editing) return;
    const roomNumber = editNumber.trim();
    const floor = Number(editFloor);
    if (!roomNumber) return toast.error("Room number is required");
    if (Number.isNaN(floor) || floor < 0)
      return toast.error("Enter a valid floor");
    if (
      rooms.some(
        (r) =>
          r.number.toLowerCase() === roomNumber.toLowerCase() &&
          r.id !== editing.id,
      )
    ) {
      return toast.error(`Room ${roomNumber} already exists`);
    }

    update.mutate(
      { id: editing.id, patch: { number: roomNumber, floor } },
      {
        onSuccess: () => {
          toast.success("Room updated");
          setEditOpen(false);
        },
      },
    );
  };

  const del = async (room: Room) => {
    const hasBooking = bookings.some(
      (b) =>
        b.roomId === room.id &&
        (b.status === "Reserved" || b.status === "Checked In"),
    );
    if (hasBooking)
      return toast.error(
        `Room ${room.number} has an active booking and cannot be removed.`,
      );
    const ok = await confirm({
      title: `Remove Room ${room.number}?`,
      description: "This removes the room from the configuration.",
      destructive: true,
      confirmText: "Remove",
    });
    if (ok)
      remove.mutate(room.id, {
        onSuccess: () => toast.success("Room removed"),
      });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label className="text-xs">Room Number</Label>
              <Input
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="e.g. 101"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRoom();
                  }
                }}
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-28">
              <Label className="text-xs">Floor</Label>
              <Input
                type="number"
                min={0}
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                placeholder="1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRoom();
                  }
                }}
              />
            </div>
            <Button
              onClick={addRoom}
              disabled={create.isPending}
              className="w-full gap-1.5 sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Add Room
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Room Number</TableHead>
                  <TableHead className="text-center">Floor</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No rooms yet. Add one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 font-medium">
                        {r.number}
                      </TableCell>
                      <TableCell className="text-center">{r.floor}</TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => del(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Room Number</Label>
              <Input
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Floor</Label>
              <Input
                type="number"
                min={0}
                value={editFloor}
                onChange={(e) => setEditFloor(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
