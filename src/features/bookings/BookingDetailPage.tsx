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
import { Checkbox } from '@/components/ui/checkbox';
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
  computeSplitBookingBill,
  isExtraChargePaid,
  paymentsByMode,
  roomPaymentsOnly,
  sumPayments,
} from '@/utils/finance';
import { formatDate, formatINR } from '@/utils/format';
import { BookingFormDialog } from './BookingFormDialog';
import { BookingCheckoutDialog } from './BookingCheckoutDialog';
import { buildSettledExtras } from './bookingCheckout';
import { Invoice } from './Invoice';
import { PAYMENT_MODES, PAYMENT_ACCOUNTS, PAYMENT_ACCOUNT_LABELS } from '@/config/constants';
import type { BookingCharge, BookingPayment, PaymentAccount, PaymentMode } from '@/types';
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
  const [payAccount, setPayAccount] = useState<PaymentAccount>('None');
  const [chargeLabel, setChargeLabel] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeMode, setChargeMode] = useState<PaymentMode>('Cash');
  const [chargeAccount, setChargeAccount] = useState<PaymentAccount>('None');
  const [chargePaidAtOrder, setChargePaidAtOrder] = useState(false);
  const [collectModes, setCollectModes] = useState<Record<string, PaymentMode>>({});
  const [collectAccounts, setCollectAccounts] = useState<Record<string, PaymentAccount>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
  const billPayments = roomPaymentsOnly(payments, extraCharges);
  const roomModeTotals = paymentsByMode(billPayments);
  const taxPercent =
    booking.taxPercent > 0 ? booking.taxPercent : (settings?.taxPercent ?? 0);
  const bill = computeSplitBookingBill({
    roomAmount: roomTotal,
    extraCharges,
    foodAmount: booking.foodAmount,
    roomService: booking.roomService,
    discount: booking.discount,
    taxPercent,
    payments,
  });
  const { taxAmount, roomTotal: roomBillTotal, roomBalance: balance, grandTotal } = bill;
  const status = calculatePaymentStatus(roomBillTotal, bill.roomPaid);

  const persistBill = async (
    nextExtras: BookingCharge[],
    nextPayments: BookingPayment[],
    patch: Partial<typeof booking> = {},
  ) => {
    const paid = sumPayments(nextPayments);
    const nextBill = computeSplitBookingBill({
      roomAmount: roomTotal,
      extraCharges: nextExtras,
      foodAmount: booking.foodAmount,
      roomService: booking.roomService,
      discount: booking.discount,
      taxPercent,
      payments: nextPayments,
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
      { id: chargeId, label, amount, paymentMode: chargeMode, account: chargeAccount, paidAtOrder: chargePaidAtOrder },
    ];
    const nextPayments: BookingPayment[] = [...payments];
    if (chargePaidAtOrder) {
      nextPayments.push({
        id: `pay-${chargeId}`,
        amount,
        mode: chargeMode,
        account: chargeAccount,
        date: dayjs().format('YYYY-MM-DD'),
        note: label,
      });
    }
    await persistBill(next, nextPayments);
    setChargeLabel('');
    setChargeAmount('');
    setChargeMode('Cash');
    setChargeAccount('None');
    setChargePaidAtOrder(false);
    toast.success(
      chargePaidAtOrder ? `${label} added · paid ${chargeMode}` : `${label} added · pending`,
    );
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
    const nextPayments = payments.filter((p) => p.id !== `pay-${charge.id}`);
    await persistBill(next, nextPayments);
    toast.success('Charge removed');
  };

  const collectExtraCharge = async (charge: BookingCharge) => {
    const mode = collectModes[charge.id] ?? charge.paymentMode;
    const account = collectAccounts[charge.id] ?? charge.account ?? 'None';
    const { nextExtras, nextPayments } = buildSettledExtras(booking, [charge.id], {
      [charge.id]: mode,
    }, {
      [charge.id]: account,
    });
    await persistBill(nextExtras, nextPayments);
    toast.success(`${charge.label} · ${formatINR(charge.amount)} collected (${mode})`);
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
      account: payAccount,
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

  const checkOut = () => {
    setCheckoutOpen(true);
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
                <Row label="  Taxable" value={bill.taxable} />
                <Row label={`  GST (${taxPercent}%)`} value={taxAmount} />
              </>
            )}
            {(booking.foodAmount > 0 || booking.roomService > 0) && (
              <>
                {booking.foodAmount > 0 && <Row label="Food" value={booking.foodAmount} />}
                {booking.roomService > 0 && (
                  <Row label="Room Service" value={booking.roomService} />
                )}
              </>
            )}
            <div className="my-2 border-t" />
            <Row label="Total" value={roomBillTotal} strong />
            <Row label="Paid" value={bill.roomPaid} />
            {Object.entries(roomModeTotals).map(([mode, amt]) => (
              <Row key={mode} label={`  ${mode}`} value={amt} />
            ))}
            <Row label="Due" value={balance} strong danger />
            {extraCharges.length > 0 && (
              <>
                <div className="my-2 border-t" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Extra Charges
                </p>
                {extraCharges.map((c) => {
                  const paid = isExtraChargePaid(c, payments);
                  return (
                    <Row
                      key={c.id}
                      label={`${c.label}${paid ? ` (${c.paymentMode})` : ''} · ${paid ? 'Paid' : 'Pending'}`}
                      value={c.amount}
                      danger={!paid}
                    />
                  );
                })}
                {bill.extrasPending > 0 && (
                  <Row label="Extras Pending" value={bill.extrasPending} danger />
                )}
                {bill.extrasPaid > 0 && (
                  <Row label="Extras Paid" value={bill.extrasPaid} />
                )}
              </>
            )}
            {extraCharges.length > 0 && (
              <>
                <div className="my-2 border-t" />
                <Row label="Grand Total" value={grandTotal} strong />
              </>
            )}
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
              <Select
                value={chargeMode}
                onValueChange={(v) => {
                  const mode = v as PaymentMode;
                  setChargeMode(mode);
                  if (mode === 'Cash') setChargeAccount('None');
                }}
              >
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
            <div className="w-full space-y-1.5 sm:w-36">
              <Label className="text-xs">Account</Label>
              <Select
                value={chargeAccount}
                onValueChange={(v) => setChargeAccount(v as PaymentAccount)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_ACCOUNTS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {PAYMENT_ACCOUNT_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addExtraCharge} className="w-full gap-1.5 sm:w-auto">
              <Plus className="h-4 w-4" /> Add to Bill
            </Button>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={chargePaidAtOrder}
              onCheckedChange={(v) => setChargePaidAtOrder(v === true)}
            />
            <span>Paid at time of order</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Leave unchecked to add as pending — use Collect on the charge or settle at checkout.
          </p>

          {extraCharges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No extras yet. Add water bottles, room service, or anything the guest requests.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {extraCharges.map((c) => {
                const paid = isExtraChargePaid(c, payments);
                const collectMode = collectModes[c.id] ?? c.paymentMode;
                return (
                  <div key={c.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">
                        <Money value={c.amount} muteZero={false} />
                        {paid ? ` · Paid · ${c.paymentMode}${c.account && c.account !== 'None' ? ` · ${PAYMENT_ACCOUNT_LABELS[c.account]}` : ''}` : ' · Pending'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                      {!paid && (
                        <>
                          <Select
                            value={collectMode}
                            onValueChange={(v) =>
                              setCollectModes((prev) => ({ ...prev, [c.id]: v as PaymentMode }))
                            }
                          >
                            <SelectTrigger className="h-8 w-[calc(50%-0.1875rem)] text-xs sm:w-[100px]">
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
                          <Select
                            value={collectAccounts[c.id] ?? c.account ?? 'None'}
                            onValueChange={(v) =>
                              setCollectAccounts((prev) => ({ ...prev, [c.id]: v as PaymentAccount }))
                            }
                          >
                            <SelectTrigger className="h-8 w-[calc(50%-0.1875rem)] text-xs sm:w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_ACCOUNTS.map((a) => (
                                <SelectItem key={a} value={a}>
                                  {PAYMENT_ACCOUNT_LABELS[a]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 flex-1 sm:flex-none"
                            onClick={() => collectExtraCharge(c)}
                          >
                            Collect
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-destructive"
                        onClick={() => removeExtraCharge(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
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
              Room rent collections only — pending extras are collected separately.
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
                <Select
                  value={payMode}
                  onValueChange={(v) => {
                    const mode = v as PaymentMode;
                    setPayMode(mode);
                    if (mode === 'Cash') setPayAccount('None');
                  }}
                >
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
              <div className="w-36">
                <Label className="mb-1.5 block text-xs">Account</Label>
                <Select value={payAccount} onValueChange={(v) => setPayAccount(v as PaymentAccount)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_ACCOUNTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a} Account
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
                        {p.account && p.account !== 'None' ? ` · ${PAYMENT_ACCOUNT_LABELS[p.account]}` : ''}
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

      <BookingCheckoutDialog
        booking={booking}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        taxPercent={taxPercent}
      />

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
    <div className="flex items-start justify-between gap-2">
      <span className={`min-w-0 flex-1 ${strong ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <Money value={value} className={`shrink-0 ${strong ? 'font-semibold' : ''}`} colored={danger} muteZero={false} />
    </div>
  );
}
