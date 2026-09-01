import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Pencil, LogIn, LogOut, FileText, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, EmptyState } from '@/components/shared/states';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/shared/StatusBadge';
import { Money } from '@/components/shared/Money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useBookings,
  useSettings,
  bookingHooks,
  notificationHooks,
} from '@/hooks/useEntities';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import {
  calculatePaymentStatus,
  calculatePendingAmount,
  computeBookingBill,
  paymentsByMode,
  roomPaymentsOnly,
  sumPayments,
} from '@/utils/finance';
import { formatDate, formatINR } from '@/utils/format';
import { BookingFormDialog } from './BookingFormDialog';
import { Invoice } from './Invoice';
import { PAYMENT_MODES } from '@/config/constants';
import type { BookingCharge, BookingPayment, PaymentMode } from '@/types';
import dayjs from 'dayjs';

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: bookings = [], isLoading } = useBookings();
  const { data: settings } = useSettings();
  const update = bookingHooks.useUpdate();
  const createNotification = notificationHooks.useCreate();
  const confirm = useConfirm();

  const [editOpen, setEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<PaymentMode>('Cash');
  const [chargeLabel, setChargeLabel] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeMode, setChargeMode] = useState<PaymentMode>('Cash');

  const booking = useMemo(() => bookings.find((b) => b.id === id), [bookings, id]);

  if (isLoading) return <LoadingState />;
  if (!booking)
    return (
      <EmptyState
        title="Booking not found"
        action={
          <Button asChild>
            <Link to="/bookings">Back to bookings</Link>
          </Button>
        }
      />
    );

  const roomTotal = booking.roomAmount || booking.roomRate * booking.nights;
  const extraCharges = booking.extraCharges ?? [];
  const payments: BookingPayment[] =
    booking.payments?.length
      ? booking.payments
      : booking.paidAmount > 0
        ? [
            {
              id: 'legacy-pay',
              amount: booking.paidAmount,
              mode: booking.paymentMode,
              date: booking.checkInDate,
              note: 'Payment',
            },
          ]
        : [];
  const paidTotal = payments.length ? sumPayments(payments) : booking.paidAmount;
  const billPayments = roomPaymentsOnly(payments, extraCharges);
  const modeTotals = paymentsByMode(payments);
  const taxPercent =
    booking.taxPercent > 0 ? booking.taxPercent : (settings?.taxPercent ?? 0);
  const bill = computeBookingBill({
    roomAmount: roomTotal,
    extraCharges,
    foodAmount: booking.foodAmount,
    roomService: booking.roomService,
    discount: booking.discount,
    taxPercent,
    paidAmount: paidTotal,
  });
  const { taxAmount, totalAmount: grandTotal, balanceAmount: balance } = bill;
  const status = calculatePaymentStatus(grandTotal, paidTotal);

  const persistBill = async (
    nextExtras: BookingCharge[],
    nextPayments: BookingPayment[],
    patch: Partial<typeof booking> = {},
  ) => {
    const paid = sumPayments(nextPayments);
    const nextBill = computeBookingBill({
      roomAmount: roomTotal,
      extraCharges: nextExtras,
      foodAmount: booking.foodAmount,
      roomService: booking.roomService,
      discount: booking.discount,
      taxPercent,
      paidAmount: paid,
    });
    const lastMode =
      nextPayments.length > 0
        ? nextPayments[nextPayments.length - 1].mode
        : booking.paymentMode;
    return update.mutateAsync({
      id: booking.id,
      patch: {
        extraCharges: nextExtras,
        payments: nextPayments,
        otherCharges: nextBill.otherCharges,
        taxPercent,
        taxAmount: nextBill.taxAmount,
        totalAmount: nextBill.totalAmount,
        paidAmount: paid,
        balanceAmount: nextBill.balanceAmount,
        paymentMode: lastMode,
        ...patch,
      },
    });
  };

  const addExtraCharge = async () => {
    const label = chargeLabel.trim();
    const amount = Number(chargeAmount);
    if (!label) return toast.error('Enter what was ordered (e.g. Water bottle)');
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');

    const chargeId = `xc-${Date.now()}`;
    const next: BookingCharge[] = [
      ...extraCharges,
      { id: chargeId, label, amount, paymentMode: chargeMode },
    ];
    await persistBill(next, payments);
    setChargeLabel('');
    setChargeAmount('');
    setChargeMode('Cash');
    toast.success(`${label} added · ${chargeMode}`);
  };

  const removeExtraCharge = async (charge: BookingCharge) => {
    const ok = await confirm({
      title: `Remove “${charge.label}”?`,
      description: `${formatINR(charge.amount)} (${charge.paymentMode ?? 'Cash'}) will be removed from this bill.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const next = extraCharges.filter((c) => c.id !== charge.id);
    await persistBill(next, payments);
    toast.success('Charge removed');
  };

  const recordPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (amount > balance) {
      toast.error(`Amount exceeds balance of ${formatINR(balance)}`);
      return;
    }
    const entry: BookingPayment = {
      id: `pay-${Date.now()}`,
      amount,
      mode: payMode,
      date: dayjs().format('YYYY-MM-DD'),
    };
    const nextPayments = [...payments, entry];
    await persistBill(extraCharges, nextPayments);
    createNotification.mutate({
      type: 'Payment Received',
      title: 'Payment received',
      message: `${formatINR(amount)} (${payMode}) from ${booking.guestName}`,
      read: false,
    });
    setPayAmount('');
    toast.success(`${formatINR(amount)} recorded as ${payMode}`);
  };

  const removePayment = async (payment: BookingPayment) => {
    const ok = await confirm({
      title: `Remove ${formatINR(payment.amount)} ${payment.mode} payment?`,
      description: 'This will increase the outstanding balance.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const next = payments.filter((p) => p.id !== payment.id);
    await persistBill(extraCharges, next);
    toast.success('Payment removed');
  };

  const checkIn = async () => {
    await update.mutateAsync({ id: booking.id, patch: { status: 'Checked In' } });
    toast.success('Guest checked in');
  };

  const checkOut = async () => {
    const due = calculatePendingAmount(grandTotal, paidTotal);
    if (due > 0) {
      toast.error(
        `Cannot check out — ₹${due} still pending. Collect full payment first.`,
      );
      return;
    }
    await update.mutateAsync({
      id: booking.id,
      patch: {
        status: 'Checked Out',
        taxPercent,
        taxAmount,
        totalAmount: grandTotal,
        paidAmount: paidTotal,
        balanceAmount: 0,
        otherCharges: bill.otherCharges,
        extraCharges,
        payments,
      },
    });
    toast.success('Guest checked out');
  };

  const handlePrint = () => {
    setInvoiceOpen(false);
    const prevTitle = document.title;
    document.title = ' ';
    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    requestAnimationFrame(() => window.print());
  };

  return (
    <div className="space-y-4">
      {settings &&
        createPortal(
          <div id="invoice-print-root" aria-hidden="true">
            <Invoice booking={booking} settings={settings} />
          </div>,
          document.body,
        )}

      <PageHeader
        title={`Booking ${booking.code}`}
        description={`${booking.guestName} · Room ${booking.roomNumber}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {booking.status === 'Reserved' && (
              <Button size="sm" onClick={checkIn} className="gap-1.5">
                <LogIn className="h-4 w-4" /> Check In
              </Button>
            )}
            {(booking.status === 'Checked In' || booking.status === 'Reserved') && (
              <Button size="sm" onClick={checkOut} className="gap-1.5">
                <LogOut className="h-4 w-4" /> Check Out
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Booking Details</CardTitle>
            <div className="flex gap-2">
              <BookingStatusBadge status={booking.status} />
              <PaymentStatusBadge status={status} />
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Detail label="Guest" value={booking.guestName} />
            <Detail
              label="Mobile"
              value={booking.mobile && booking.mobile !== '—' ? booking.mobile : '—'}
            />
            <Detail label="Email" value={booking.email ?? '—'} />
            <Detail label="Room" value={`${booking.roomNumber} · ${booking.roomType}`} />
            <Detail label="Check-in" value={formatDate(booking.checkInDate)} />
            <Detail label="Check-out" value={formatDate(booking.checkOutDate)} />
            <Detail label="Nights" value={String(booking.nights)} />
            <Detail label="Guests" value={`${booking.adults} adults, ${booking.children} children`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Room Tariff (incl. GST)" value={roomTotal} />
            {taxPercent > 0 && (
              <>
                <Row label={`  Taxable`} value={bill.taxable} />
                <Row label={`  GST (${taxPercent}%)`} value={taxAmount} />
              </>
            )}
            {extraCharges.map((c) => (
              <Row key={c.id} label={`${c.label} (${c.paymentMode ?? 'Cash'})`} value={c.amount} />
            ))}
            <div className="my-2 border-t" />
            <Row label="Total" value={grandTotal} strong />
            <Row label="Paid" value={paidTotal} />
            {Object.entries(modeTotals).map(([mode, amt]) => (
              <Row key={mode} label={`  ${mode}`} value={amt} />
            ))}
            <Row label="Balance" value={balance} strong danger />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extra Charges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label className="text-xs">Item / Request</Label>
              <Input
                value={chargeLabel}
                onChange={(e) => setChargeLabel(e.target.value)}
                placeholder="Water bottle, laundry, snacks…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addExtraCharge();
                  }
                }}
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-32">
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addExtraCharge();
                  }
                }}
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-36">
              <Label className="text-xs">Payment Mode</Label>
              <Select value={chargeMode} onValueChange={(v) => setChargeMode(v as PaymentMode)}>
                <SelectTrigger>
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
            </div>
            <Button onClick={addExtraCharge} className="w-full gap-1.5 sm:w-auto">
              <Plus className="h-4 w-4" /> Add to Bill
            </Button>
          </div>

          {extraCharges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No extras yet. Add water bottles, room service, or anything the guest requests.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {extraCharges.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">
                      <Money value={c.amount} muteZero={false} /> · {c.paymentMode ?? 'Cash'}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() => removeExtraCharge(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Room rent and balance collections only — extras are added above, then paid here.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[120px] flex-1">
                <Label className="mb-1.5 block text-xs">Amount</Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="₹"
                />
              </div>
              <div className="w-36">
                <Label className="mb-1.5 block text-xs">Mode</Label>
                <Select value={payMode} onValueChange={(v) => setPayMode(v as PaymentMode)}>
                  <SelectTrigger>
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
              </div>
              <Button onClick={recordPayment} disabled={balance <= 0}>
                {balance <= 0 ? 'Fully Paid' : 'Add Payment'}
              </Button>
            </div>

            {billPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {billPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <Money value={p.amount} muteZero={false} /> · {p.mode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.date)}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => removePayment(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setInvoiceOpen(true)}
          >
            <FileText className="h-4 w-4" /> View Invoice
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <BookingFormDialog open={editOpen} onOpenChange={setEditOpen} booking={booking} />

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-2xl">
          {settings && (
            <div className="overflow-auto bg-white">
              <Invoice booking={booking} settings={settings} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: number;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <Money value={value} className={strong ? 'font-semibold' : ''} colored={danger} muteZero={false} />
    </div>
  );
}
