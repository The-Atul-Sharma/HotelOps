import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Money } from '@/components/shared/Money';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { bookingHooks } from '@/hooks/useEntities';
import { PAYMENT_MODES, PAYMENT_ACCOUNTS, PAYMENT_ACCOUNT_LABELS } from '@/config/constants';
import { isExtraChargePaid } from '@/utils/finance';
import { formatINR } from '@/utils/format';
import type { Booking, PaymentAccount, PaymentMode } from '@/types';
import {
  buildCheckoutPatch,
  buildSettledExtras,
  getBookingBillState,
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
  const [settleIds, setSettleIds] = useState<Set<string>>(new Set());
  const [collectModes, setCollectModes] = useState<Record<string, PaymentMode>>({});
  const [collectAccounts, setCollectAccounts] = useState<Record<string, PaymentAccount>>({});
  const [submitting, setSubmitting] = useState(false);

  const taxPercent = booking
    ? (taxPercentProp ?? resolveTaxPercent(booking))
    : 0;
  const state = booking ? getBookingBillState(booking, taxPercent) : null;
  const pendingExtras = state?.pendingExtras ?? [];
  const balance = state?.balance ?? 0;
  const grandTotal = state?.grandTotal ?? 0;

  useEffect(() => {
    if (!open || !booking) return;
    const pending = getBookingBillState(booking, taxPercent).pendingExtras;
    setSettleIds(new Set(pending.map((c) => c.id)));
    setCollectModes(Object.fromEntries(pending.map((c) => [c.id, c.paymentMode])));
    setCollectAccounts(Object.fromEntries(pending.map((c) => [c.id, c.account ?? 'None'])));
  }, [open, booking, taxPercent]);

  const finishCheckOut = async (
    extras = state?.extraCharges ?? [],
    pmt = state?.payments ?? [],
  ) => {
    if (!booking) return;
    setSubmitting(true);
    try {
      await update.mutateAsync({
        id: booking.id,
        patch: buildCheckoutPatch(booking, taxPercent, extras, pmt),
      });
      onOpenChange(false);
      toast.success(`Room ${booking.roomNumber} checked out`);
      onComplete?.();
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCheckOut = async () => {
    if (!booking || !state) return;
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
      );
      setSubmitting(true);
      try {
        await update.mutateAsync({
          id: booking.id,
          patch: buildCheckoutPatch(booking, taxPercent, nextExtras, nextPayments),
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

  const { bill, extraCharges, payments } = state;
  const roomBillTotal = bill.roomTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check Out — {booking.guestName}</DialogTitle>
          <DialogDescription>
            Room {booking.roomNumber} · Review dues and pending extras before checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Room Bill
            </p>
            <div className="flex justify-between gap-2">
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

          {extraCharges.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Extra Charges
              </p>
              {extraCharges.map((c) => {
                const paid = isExtraChargePaid(c, payments);
                return (
                  <div key={c.id} className="flex justify-between gap-2">
                    <span className={paid ? 'text-muted-foreground' : 'text-destructive'}>
                      {c.label}
                      {paid ? ` (${c.paymentMode})` : ' · Pending'}
                    </span>
                    <Money value={c.amount} muteZero={false} />
                  </div>
                );
              })}
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
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                  >
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
                      <p className="font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">
                        <Money value={c.amount} muteZero={false} />
                      </p>
                    </div>
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
                      <SelectTrigger className="h-8 w-[110px] shrink-0 text-xs">
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
                      <SelectTrigger className="h-8 w-[100px] shrink-0 text-xs">
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
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2 border-t pt-2 font-semibold">
            <span>Grand total</span>
            <Money value={grandTotal} muteZero={false} />
          </div>
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={confirmCheckOut} disabled={balance > 0 || submitting}>
            Checkout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
