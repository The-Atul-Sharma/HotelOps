import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { appDay, appNow } from '@/lib/dayjs';
import { Trash2 } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/shared/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Money } from '@/components/shared/Money';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import {
  useRooms,
  useBookings,
  useGuests,
  useSettings,
  bookingHooks,
  guestHooks,
  useNotifyUsers,
} from '@/hooks/useEntities';
import { calculateNights, computeBookingBill, round2 } from '@/utils/finance';
import { formatRoomTariffLabel } from '@/utils/format';
import { hasConflict } from './bookingUtils';
import { nextBookingCode } from '@/services/mockData';
import {
  PAYMENT_MODES,
  PAYMENT_ACCOUNTS,
  ID_TYPES,
  formatPaymentAccount,
} from '@/config/constants';
import type { Booking, BookingPayment, IdType, PaymentAccount, PaymentMode } from '@/types';

const FORM_STATUSES = ['Checked In', 'Reserved'] as const;

const optionalAmount = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? 0 : v),
  z.coerce.number().min(0),
);

const schema = z
  .object({
    guestName: z.string().min(2, 'Guest name is required'),
    mobile: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    idType: z.enum(ID_TYPES as [IdType, ...IdType[]]),
    idNumber: z.string().optional(),
    roomId: z.string().min(1, 'Select a room'),
    checkInDate: z.string().min(1, 'Check-in date required'),
    checkOutDate: z.string().min(1, 'Check-out date required'),
    adults: z.coerce.number().int().min(1),
    children: z.coerce.number().int().min(0),
    roomTariff: optionalAmount,
    advanceReceived: optionalAmount,
    paymentMode: z.enum(PAYMENT_MODES as [PaymentMode, ...PaymentMode[]]),
    paymentAccount: z.enum(PAYMENT_ACCOUNTS as [PaymentAccount, ...PaymentAccount[]]),
    status: z.enum(FORM_STATUSES),
    notes: z.string().optional(),
  })
  .refine((d) => appDay(d.checkOutDate).isAfter(appDay(d.checkInDate)), {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  });

type FormValues = z.input<typeof schema>;

export function BookingFormDialog({
  open,
  onOpenChange,
  booking,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  booking?: Booking;
}) {
  const { data: rooms = [] } = useRooms();
  const { data: bookings = [] } = useBookings();
  const { data: guests = [] } = useGuests();
  const { data: settings } = useSettings();
  const createBooking = bookingHooks.useCreate();
  const updateBooking = bookingHooks.useUpdate();
  const removeBooking = bookingHooks.useRemove();
  const createGuest = guestHooks.useCreate();
  const updateGuest = guestHooks.useUpdate();
  const notifyUsers = useNotifyUsers();
  const confirm = useConfirm();
  const submittingRef = useRef(false);

  const isSaving =
    createBooking.isPending ||
    updateBooking.isPending ||
    createGuest.isPending ||
    updateGuest.isPending;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      guestName: '',
      mobile: '',
      email: '',
      idType: 'Aadhaar',
      idNumber: '',
      roomId: '',
      checkInDate: appNow().format('YYYY-MM-DD'),
      checkOutDate: appNow().add(1, 'day').format('YYYY-MM-DD'),
      adults: 1,
      children: 0,
      roomTariff: undefined,
      advanceReceived: undefined,
      paymentMode: 'Cash',
      paymentAccount: 'None',
      status: 'Checked In',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (booking) {
      const guest = guests.find((g) => g.id === booking.guestId);
      const status =
        booking.status === 'Reserved' || booking.status === 'Checked In'
          ? booking.status
          : 'Checked In';
      reset({
        guestName: booking.guestName,
        mobile: booking.mobile ?? '',
        email: booking.email ?? '',
        idType: guest?.idType ?? 'Aadhaar',
        idNumber: guest?.idNumber ?? '',
        roomId: booking.roomId,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        adults: booking.adults,
        children: booking.children,
        roomTariff:
          booking.roomRate > 0
            ? booking.roomRate
            : booking.nights > 0
              ? round2((booking.roomAmount || booking.totalAmount || 0) / booking.nights)
              : booking.roomAmount || booking.totalAmount || undefined,
        advanceReceived: booking.advanceReceived || undefined,
        paymentMode: booking.paymentMode,
        paymentAccount:
          booking.payments?.find((p) => p.note === 'Advance')?.account ?? 'None',
        status,
        notes: booking.notes ?? '',
      });
    } else {
      reset({
        guestName: '',
        mobile: '',
        email: '',
        idType: 'Aadhaar',
        idNumber: '',
        roomId: '',
        checkInDate: appNow().format('YYYY-MM-DD'),
        checkOutDate: appNow().add(1, 'day').format('YYYY-MM-DD'),
        adults: 1,
        children: 0,
        roomTariff: undefined,
        advanceReceived: undefined,
        paymentMode: 'Cash',
        paymentAccount: 'None',
        status: 'Checked In',
        notes: '',
      });
    }
  }, [open, booking, guests, reset]);

  const values = watch();
  const selectedRoom = rooms.find((r) => r.id === values.roomId);

  const calc = useMemo(() => {
    const nights = calculateNights(values.checkInDate, values.checkOutDate);
    const roomRate = Number(values.roomTariff) || 0;
    const roomAmount = round2(roomRate * nights);
    const taxPercent = settings?.taxPercent ?? 0;
    const extras = booking?.extraCharges ?? [];
    const bill = computeBookingBill({
      roomAmount,
      extraCharges: extras,
      discount: booking?.discount ?? 0,
      taxPercent,
      paidAmount: Number(values.advanceReceived) || 0,
    });
    return {
      nights,
      roomRate,
      roomAmount,
      extrasTotal: bill.otherCharges,
      taxPercent,
      taxAmount: bill.taxAmount,
      totalAmount: bill.totalAmount,
      balance: bill.balanceAmount,
    };
  }, [values, settings?.taxPercent, booking?.extraCharges]);

  const availableRooms = rooms.filter(
    (r) =>
      r.active &&
      !hasConflict(bookings, r.id, values.checkInDate, values.checkOutDate, booking?.id),
  );

  const onSubmit = async (v: FormValues) => {
    if (submittingRef.current || isSaving) return;
    if (!selectedRoom) {
      toast.error('Select a room');
      return;
    }
    submittingRef.current = true;
    try {
    const conflict = hasConflict(bookings, v.roomId, v.checkInDate, v.checkOutDate, booking?.id);
    if (conflict) {
      toast.error(`Room ${selectedRoom.number} is already booked (${conflict.code}) for these dates.`);
      return;
    }

    const mobile = (v.mobile ?? '').trim();
    const guestName = v.guestName.trim();
    const idType = v.idType as IdType;
    const idNumber = (v.idNumber ?? '').trim() || undefined;
    let guest = booking
      ? guests.find((g) => g.id === booking.guestId)
      : mobile
        ? guests.find((g) => g.mobile === mobile)
        : guests.find(
            (g) => g.name.toLowerCase() === guestName.toLowerCase() && g.mobile === '—',
          );
    if (!guest) {
      guest = await createGuest.mutateAsync({
        name: guestName,
        mobile: mobile || '—',
        email: v.email || undefined,
        idType,
        idNumber,
        nationality: 'Indian',
      });
    } else {
      await updateGuest.mutateAsync({
        id: guest.id,
        patch: {
          name: guestName,
          mobile: mobile || guest.mobile || '—',
          email: v.email || undefined,
          idType,
          idNumber,
        },
      });
    }

    const nights = calculateNights(v.checkInDate, v.checkOutDate);
    const roomRate = Number(v.roomTariff) || 0;
    const roomAmount = round2(roomRate * nights);
    const advance = Number(v.advanceReceived) || 0;
    const taxPercent = settings?.taxPercent ?? 0;
    const extraCharges = booking?.extraCharges ?? [];
    const mode = v.paymentMode as PaymentMode;
    const account = v.paymentAccount as PaymentAccount;

    let payments: BookingPayment[];
    if (booking) {
      const existing = [...(booking.payments ?? [])];
      const advanceIdx = existing.findIndex((p) => p.note === 'Advance');
      if (advance > 0) {
        if (advanceIdx >= 0) {
          existing[advanceIdx] = { ...existing[advanceIdx], amount: advance, mode, account };
        } else {
          existing.unshift({
            id: `pay-${Date.now()}`,
            amount: advance,
            mode,
            account,
            date: v.checkInDate,
            note: 'Advance',
          });
        }
      } else if (advanceIdx >= 0) {
        existing.splice(advanceIdx, 1);
      }
      payments = existing;
    } else {
      payments =
        advance > 0
          ? [
              {
                id: `pay-${Date.now()}`,
                amount: advance,
                mode,
                account,
                date: v.checkInDate,
                note: 'Advance',
              },
            ]
          : [];
    }

    const paidAmount = booking
      ? Math.max(0, (booking.paidAmount ?? 0) - (booking.advanceReceived ?? 0) + advance)
      : advance;
    const bill = computeBookingBill({
      roomAmount,
      extraCharges,
      discount: booking?.discount ?? 0,
      taxPercent,
      paidAmount,
    });

    const payload: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> = {
      code: booking?.code ?? nextBookingCode(bookings),
      guestId: guest.id,
      guestName: v.guestName,
      mobile: mobile || '—',
      email: v.email || undefined,
      roomId: v.roomId,
      roomNumber: selectedRoom.number,
      roomType: selectedRoom.type || 'Standard',
      checkInDate: v.checkInDate,
      checkInTime: '13:00',
      checkOutDate: v.checkOutDate,
      checkOutTime: '11:00',
      adults: Number(v.adults),
      children: Number(v.children),
      roomRate,
      nights,
      roomAmount,
      foodAmount: booking?.foodAmount ?? 0,
      roomService: booking?.roomService ?? 0,
      otherCharges: bill.otherCharges,
      extraCharges,
      discount: booking?.discount ?? 0,
      taxPercent,
      taxAmount: bill.taxAmount,
      totalAmount: bill.totalAmount,
      advanceReceived: advance,
      paidAmount,
      balanceAmount: bill.balanceAmount,
      paymentMode: mode,
      payments,
      status: v.status,
      notes: v.notes,
    };

    if (booking) {
      await updateBooking.mutateAsync({ id: booking.id, patch: payload });
      toast.success('Booking updated');
    } else {
      const created = await createBooking.mutateAsync(payload);
      notifyUsers.mutate({
        type: 'New Booking',
        title: `New booking ${created.code}`,
        message: `${created.guestName} · Room ${created.roomNumber}`,
        read: false,
      });
      toast.success('Booking created');
    }
    onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save booking');
    } finally {
      submittingRef.current = false;
    }
  };

  const handleDelete = async () => {
    if (!booking) return;
    const ok = await confirm({
      title: `Delete booking for ${booking.guestName}?`,
      description: `Room ${booking.roomNumber} · This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await removeBooking.mutateAsync(booking.id);
    toast.success('Booking deleted');
    onOpenChange(false);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="flex max-h-[90dvh] max-w-none flex-col sm:max-w-2xl">
        <ResponsiveModalHeader className="border-b">
          <ResponsiveModalTitle>{booking ? 'Edit Booking' : 'New Booking'}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <ResponsiveModalBody className="px-0 py-0">
          <form
            id="booking-form"
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-4 px-6 py-4 sm:grid-cols-2"
          >
            <Field label="Guest Name" error={errors.guestName?.message}>
              <Input {...register('guestName')} placeholder="Full name" />
            </Field>
            <Field label="Mobile (optional)" error={errors.mobile?.message}>
              <Input {...register('mobile')} placeholder="+91 …" />
            </Field>
            <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" error={errors.email?.message} className="min-w-0">
                <Input {...register('email')} placeholder="optional" />
              </Field>
              <Field label="Status" className="min-w-0">
                <Select
                  value={values.status}
                  onValueChange={(v) => setValue('status', v as (typeof FORM_STATUSES)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Document Type" className="min-w-0">
                <Select
                  value={values.idType}
                  onValueChange={(v) => setValue('idType', v as IdType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ID_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Document Number" error={errors.idNumber?.message} className="min-w-0">
                <Input {...register('idNumber')} placeholder="ID number" />
              </Field>
            </div>

            <Field label="Room Number" error={errors.roomId?.message} className="col-span-full">
              <Select value={values.roomId} onValueChange={(v) => setValue('roomId', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select room number" />
                </SelectTrigger>
                <SelectContent>
                  {availableRooms.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No rooms free for these dates
                    </div>
                  )}
                  {availableRooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.number} · Floor {r.floor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Check-in Date" error={errors.checkInDate?.message} className="min-w-0">
              <Input type="date" {...register('checkInDate')} />
            </Field>
            <Field label="Check-out Date" error={errors.checkOutDate?.message} className="min-w-0">
              <Input type="date" {...register('checkOutDate')} />
            </Field>
            <Field label="Adults">
              <Input type="number" {...register('adults')} />
            </Field>
            <Field label="Children">
              <Input type="number" {...register('children')} />
            </Field>
            <Field label="Room Tariff incl. GST (₹/night)" error={errors.roomTariff?.message}>
              <Input type="number" {...register('roomTariff')} placeholder="Per night including GST" />
            </Field>
            <Field label="Advance Received (₹)">
              <Input type="number" {...register('advanceReceived')} />
            </Field>
            <div className="col-span-full grid grid-cols-2 gap-4">
              <Field label="Payment Mode" className="min-w-0">
                <Select
                  value={values.paymentMode}
                  onValueChange={(v) => {
                    const mode = v as PaymentMode;
                    setValue('paymentMode', mode);
                    if (mode === 'Cash') setValue('paymentAccount', 'None');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Account" className="min-w-0">
                <Select
                  value={values.paymentAccount}
                  onValueChange={(v) => setValue('paymentAccount', v as PaymentAccount)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_ACCOUNTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {formatPaymentAccount(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Notes" className="col-span-full">
              <Textarea {...register('notes')} rows={2} placeholder="Special requests…" />
            </Field>

            <div className="col-span-full rounded-lg border bg-muted/40 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Summary label="Nights" value={calc.nights} isCount />
                <Summary label={formatRoomTariffLabel({ roomRate: calc.roomRate, nights: calc.nights, roomAmount: calc.roomAmount })} value={calc.roomAmount} />
                <Summary label="Total" value={calc.totalAmount} strong />
                <Summary label="Balance" value={calc.balance} strong danger={calc.balance > 0} />
              </div>
              {calc.taxPercent > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  GST {calc.taxPercent}% included in room · Tax ₹{calc.taxAmount}
                  {calc.extrasTotal > 0 ? ` · Extras ₹${calc.extrasTotal} (no GST)` : ''}
                </p>
              )}
              {calc.taxPercent <= 0 && calc.extrasTotal > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Includes extras ₹{calc.extrasTotal} (manage on booking detail)
                </p>
              )}
            </div>
          </form>
        </ResponsiveModalBody>
        <ResponsiveModalFooter className="sm:justify-between">
          {booking ? (
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5"
              onClick={handleDelete}
              disabled={removeBooking.isPending}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="booking-form" disabled={isSaving}>
              {isSaving ? 'Saving…' : booking ? 'Save Changes' : 'Create Booking'}
            </Button>
          </div>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Summary({
  label,
  value,
  strong,
  danger,
  isCount,
}: {
  label: string;
  value: number;
  strong?: boolean;
  danger?: boolean;
  isCount?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={strong ? 'text-base font-semibold' : 'font-medium'}>
        {isCount ? value : <Money value={value} colored={danger} muteZero={false} />}
      </p>
    </div>
  );
}
