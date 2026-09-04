import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Money } from '@/components/shared/Money';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/shared/ResponsiveModal';
import { bookingHooks, notificationHooks } from '@/hooks/useEntities';
import { PAYMENT_MODES, PAYMENT_ACCOUNTS, formatPaymentAccount } from '@/config/constants';
import { formatINR, formatRoomTariffLabel } from '@/utils/format';
import { roomPaymentsOnly, round2 } from '@/utils/finance';
import { formatExtraChargeDetail, formatExtraChargeLabel, groupExtraChargesForDisplay, formatGroupedExtraChargeLabel } from './bookingUtils';
import type { Booking, BookingPayment, PaymentAccount, PaymentMode } from '@/types';
import {
  buildCheckoutPatch,
  buildPaymentPatch,
  buildSettledExtras,
  getBookingBillState,
  getBookingPayments,
  resolveTaxPercent,
} from './bookingCheckout';

interface BookingCheckoutDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxPercent?: number;
  onComplete?: () => void;
}

export function BookingCheckoutDialog({
  booking,
  open,
  onOpenChange,
  taxPercent: taxPercentProp,
  onComplete,
}: BookingCheckoutDialogProps) {
  const update = bookingHooks.useUpdate();
  const createNotification = notificationHooks.useCreate();
  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [settleIds, setSettleIds] = useState<Set<string>>(new Set());
  const [collectModes, setCollectModes] = useState<Record<string, PaymentMode>>({});
  const [collectAccounts, setCollectAccounts] = useState<Record<string, PaymentAccount>>({});
  const [discountInput, setDiscountInput] = useState('0');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<PaymentMode>('Cash');
  const [payAccount, setPayAccount] = useState<PaymentAccount>('None');
  const [submitting, setSubmitting] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);

  const taxPercent = booking
    ? (taxPercentProp ?? resolveTaxPercent(booking))
    : 0;
  const discountAmount = round2(Number(discountInput) || 0);
  const state = useMemo(
    () => (booking ? getBookingBillState(booking, taxPercent, discountAmount, payments) : null),
    [booking, taxPercent, discountAmount, payments],
  );
  const pendingExtras = state?.pendingExtras ?? [];
  const balance = state?.balance ?? 0;
  const grandTotal = state?.grandTotal ?? 0;
  const roomPayments = state ? roomPaymentsOnly(state.payments, state.extraCharges) : [];

  useEffect(() => {
    if (!open || !booking) return;
    const initialPayments = getBookingPayments(booking);
    const initialDiscount = booking.discount || 0;
    setDiscountInput(String(initialDiscount));
    setPayments(initialPayments);
    setPayAmount('');
    setPayMode('Cash');
    setPayAccount('None');
    const pending = getBookingBillState(booking, taxPercent, initialDiscount, initialPayments).pendingExtras;
    setSettleIds(new Set(pending.map((c) => c.id)));
    setCollectModes(Object.fromEntries(pending.map((c) => [c.id, c.paymentMode])));
    setCollectAccounts(Object.fromEntries(pending.map((c) => [c.id, c.account ?? 'None'])));
  }, [open, booking, taxPercent]);

  const finishCheckOut = async (
    extras = state?.extraCharges ?? [],
    pmt = payments,
  ) => {
    if (!booking) return;
    setSubmitting(true);
    try {
      await update.mutateAsync({
        id: booking.id,
        patch: buildCheckoutPatch(booking, taxPercent, extras, pmt, discountAmount),
      });
      onOpenChange(false);
      toast.success(`Room ${booking.roomNumber} checked out`);
      onComplete?.();
    } finally {
      setSubmitting(false);
    }
  };

  const recordPayment = async () => {
    if (!booking) return;
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
    setRecordingPayment(true);
    try {
      await update.mutateAsync({
        id: booking.id,
        patch: buildPaymentPatch(booking, taxPercent, nextPayments, discountAmount),
      });
      setPayments(nextPayments);
      setPayAmount('');
      createNotification.mutate({
        type: 'Payment Received',
        title: 'Payment received',
        message: `${formatINR(amount)} (${payMode}) from ${booking.guestName}`,
        read: false,
      });
      toast.success(`${formatINR(amount)} recorded as ${payMode}`);
    } finally {
      setRecordingPayment(false);
    }
  };

  const confirmCheckOut = async () => {
    if (!booking || !state) return;
    if (discountAmount > state.roomTotal) {
      toast.error('Discount cannot exceed room amount');
      return;
    }
    if (balance > 0) {
      toast.error(`Collect room rent of ${formatINR(balance)} before checkout.`);
      return;
    }
    if (pendingExtras.length > 0) {
      if (settleIds.size === 0) {
        toast.error('Select at least one extra charge to collect');
        return;
      }
      if (settleIds.size < pendingExtras.length) {
        toast.error('Collect all pending extras before checkout');
        return;
      }
      const { nextExtras, nextPayments } = buildSettledExtras(
        booking,
        [...settleIds],
        collectModes,
        collectAccounts,
        payments,
      );
      setSubmitting(true);
      try {
        await update.mutateAsync({
          id: booking.id,
          patch: buildCheckoutPatch(booking, taxPercent, nextExtras, nextPayments, discountAmount),
        });
        onOpenChange(false);
        toast.success(`Room ${booking.roomNumber} checked out`);
        onComplete?.();
      } finally {
        setSubmitting(false);
      }
      return;
    }
    await finishCheckOut();
  };

  if (!booking || !state) return null;

  const { bill, extraCharges } = state;
  const roomBillTotal = bill.roomTotal;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="flex max-h-[90dvh] max-w-none flex-col sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Check Out — {booking.guestName}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Room {booking.roomNumber} · Review dues and pending extras before checkout.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ResponsiveModalBody className="space-y-4 text-sm">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Room Bill
            </p>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{formatRoomTariffLabel(booking)}</span>
              <Money value={state.roomTotal} muteZero={false} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Discount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0"
              />
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Discount applied</span>
                <Money value={-discountAmount} muteZero={false} />
              </div>
            )}
            <div className="flex justify-between gap-2 font-medium">
              <span className="text-muted-foreground">Room total</span>
              <Money value={roomBillTotal} muteZero={false} />
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Paid</span>
              <Money value={bill.roomPaid} muteZero={false} />
            </div>
            <div className="flex justify-between gap-2 font-medium">
              <span className={balance > 0 ? 'text-destructive' : ''}>Room due</span>
              <Money value={balance} colored={balance > 0} muteZero={false} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Record Payment
            </p>
            <p className="text-xs text-muted-foreground">
              Room rent collections only — pending extras are collected separately.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Mode</Label>
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Account</Label>
                  <Select
                    value={payAccount}
                    onValueChange={(v) => setPayAccount(v as PaymentAccount)}
                  >
                    <SelectTrigger>
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
                </div>
              </div>
              <Button
                className="w-full"
                onClick={recordPayment}
                disabled={balance <= 0 || recordingPayment}
              >
                {balance <= 0 ? 'Fully Paid' : recordingPayment ? 'Recording…' : 'Add Payment'}
              </Button>
            </div>
            {roomPayments.length > 0 && (
              <div className="divide-y rounded-lg border">
                {roomPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">{formatINR(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.mode}
                        {p.account && p.account !== 'None' ? ` · ${formatPaymentAccount(p.account)}` : ''}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{p.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {extraCharges.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Extra Charges
              </p>
              {groupExtraChargesForDisplay(extraCharges).map((g) => (
                <div key={g.key} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1">
                    {formatGroupedExtraChargeLabel(g)}
                  </span>
                  <Money value={g.amount} className="shrink-0" muteZero={false} />
                </div>
              ))}
              {bill.extrasPending > 0 && (
                <div className="flex justify-between gap-2 border-t pt-2 font-medium">
                  <span className="text-destructive">Extras pending</span>
                  <Money value={bill.extrasPending} colored muteZero={false} />
                </div>
              )}
              {bill.extrasPaid > 0 && (
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <span>Extras paid</span>
                  <Money value={bill.extrasPaid} muteZero={false} />
                </div>
              )}
            </div>
          )}

          {pendingExtras.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Collect now
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {pendingExtras.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Checkbox
                        checked={settleIds.has(c.id)}
                        onCheckedChange={(checked) => {
                          setSettleIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{formatExtraChargeLabel(c)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatExtraChargeDetail(c)}
                        </p>
                      </div>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 pl-7 sm:w-auto sm:shrink-0 sm:pl-0">
                      <Select
                        value={collectModes[c.id] ?? c.paymentMode}
                        onValueChange={(v) => {
                          const mode = v as PaymentMode;
                          setCollectModes((prev) => ({ ...prev, [c.id]: mode }));
                          if (mode === 'Cash') {
                            setCollectAccounts((prev) => ({ ...prev, [c.id]: 'None' }));
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 w-full text-xs sm:h-8">
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
                        <SelectTrigger className="h-9 w-full text-xs sm:h-8">
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2 border-t pt-2 font-semibold">
            <span>Grand total</span>
            <Money value={grandTotal} muteZero={false} />
          </div>
        </ResponsiveModalBody>

        <ResponsiveModalFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={confirmCheckOut} disabled={balance > 0 || submitting}>
            Checkout
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
