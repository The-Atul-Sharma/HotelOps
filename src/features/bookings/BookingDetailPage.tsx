import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Printer,
  Pencil,
  LogIn,
  LogOut,
  FileText,
  Plus,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  bookingRoomTotal,
  calculatePaymentStatus,
  computeSplitBookingBill,
  isExtraChargePaid,
  paymentsByMode,
  roomPaymentsOnly,
  sumPayments,
  round2,
} from '@/utils/finance';
import { formatDate, formatINR, formatRoomTariffLabel } from '@/utils/format';
import { printInvoice } from '@/utils/print';
import { BookingFormDialog } from './BookingFormDialog';
import { BookingCheckoutDialog } from './BookingCheckoutDialog';
import { buildSettledExtras } from './bookingCheckout';
import { buildExtraCharge, formatExtraChargeLabel, extraChargeName, recalculateExtraCharge, groupExtraChargesForDisplay, formatGroupedExtraChargeLabel } from './bookingUtils';
import { Invoice } from './Invoice';
import { PAYMENT_MODES, PAYMENT_ACCOUNTS, formatPaymentAccount, EXTRA_CHARGE_ITEM_TYPES } from '@/config/constants';
import type { BookingCharge, BookingPayment, ExtraChargeItemType, PaymentAccount, PaymentMode } from '@/types';
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
  const [chargeItemType, setChargeItemType] = useState<ExtraChargeItemType>('Water Bottle');
  const [chargeCustomName, setChargeCustomName] = useState('');
  const [chargeQuantity, setChargeQuantity] = useState('1');
  const [chargeUnitPrice, setChargeUnitPrice] = useState('');
  const [chargeMode, setChargeMode] = useState<PaymentMode>('Cash');
  const [chargeAccount, setChargeAccount] = useState<PaymentAccount>('None');
  const [chargePaidAtOrder, setChargePaidAtOrder] = useState(false);
  const [collectModes, setCollectModes] = useState<Record<string, PaymentMode>>({});
  const [collectAccounts, setCollectAccounts] = useState<Record<string, PaymentAccount>>({});
  const [chargeEdits, setChargeEdits] = useState<Record<string, { quantity: string; unitPrice: string }>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState('0');
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const booking = useMemo(() => bookings.find((b) => b.id === id), [bookings, id]);

  useEffect(() => {
    if (booking) setDiscountInput(String(booking.discount || 0));
  }, [booking?.id, booking?.discount]);

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

  const roomTotal = bookingRoomTotal(booking);
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
    const appliedDiscount = patch.discount ?? booking.discount;
    const nextBill = computeSplitBookingBill({
      roomAmount: roomTotal,
      extraCharges: nextExtras,
      foodAmount: booking.foodAmount,
      roomService: booking.roomService,
      discount: appliedDiscount,
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

  const applyDiscount = async () => {
    const discount = round2(Number(discountInput) || 0);
    if (discount > roomTotal) {
      toast.error('Discount cannot exceed room amount');
      return;
    }
    setApplyingDiscount(true);
    try {
      const nextBill = computeSplitBookingBill({
        roomAmount: roomTotal,
        extraCharges,
        foodAmount: booking.foodAmount,
        roomService: booking.roomService,
        discount,
        taxPercent,
        payments,
      });
      await update.mutateAsync({
        id: booking.id,
        patch: {
          discount,
          taxAmount: nextBill.taxAmount,
          totalAmount: nextBill.grandTotal,
          balanceAmount: nextBill.balanceAmount,
        },
      });
      toast.success('Discount applied');
    } finally {
      setApplyingDiscount(false);
    }
  };

  const addExtraCharge = async () => {
    const quantity = Number(chargeQuantity);
    const unitPrice = Number(chargeUnitPrice);
    const customName = chargeCustomName.trim();
    if (chargeItemType === 'Other' && !customName) {
      return toast.error('Enter a name for Other');
    }
    if (!quantity || quantity <= 0) return toast.error('Enter a valid quantity');
    if (!unitPrice || unitPrice <= 0) return toast.error('Enter a valid price');

    const charge = buildExtraCharge({
      itemType: chargeItemType,
      customName,
      quantity,
      unitPrice,
      paymentMode: chargeMode,
      account: chargeAccount,
      paidAtOrder: chargePaidAtOrder,
    });
    const chargeId = charge.id;
    const next: BookingCharge[] = [...extraCharges, charge];
    const nextPayments: BookingPayment[] = [...payments];
    if (chargePaidAtOrder) {
      nextPayments.push({
        id: `pay-${chargeId}`,
        amount: charge.amount,
        mode: chargeMode,
        account: chargeAccount,
        date: dayjs().format('YYYY-MM-DD'),
        note: charge.label,
      });
    }
    await persistBill(next, nextPayments);
    setChargeItemType('Water Bottle');
    setChargeCustomName('');
    setChargeQuantity('1');
    setChargeUnitPrice('');
    setChargeMode('Cash');
    setChargeAccount('None');
    setChargePaidAtOrder(false);
    toast.success(
      chargePaidAtOrder
        ? `${charge.label} added · paid ${chargeMode}`
        : `${charge.label} added · pending`,
    );
  };

  const removeExtraCharge = async (charge: BookingCharge) => {
    const ok = await confirm({
      title: `Remove “${formatExtraChargeLabel(charge)}”?`,
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
    toast.success(`${formatExtraChargeLabel(charge)} · ${formatINR(charge.amount)} collected (${mode})`);
  };

  const getChargeEdit = (charge: BookingCharge) =>
    chargeEdits[charge.id] ?? {
      quantity: String(charge.quantity ?? 1),
      unitPrice: String(charge.unitPrice ?? charge.amount),
    };

  const setChargeEdit = (
    charge: BookingCharge,
    field: 'quantity' | 'unitPrice',
    value: string,
  ) => {
    setChargeEdits((prev) => ({
      ...prev,
      [charge.id]: {
        ...(prev[charge.id] ?? {
          quantity: String(charge.quantity ?? 1),
          unitPrice: String(charge.unitPrice ?? charge.amount),
        }),
        [field]: value,
      },
    }));
  };

  const isChargeEditDirty = (charge: BookingCharge) => {
    const draft = chargeEdits[charge.id];
    if (!draft) return false;
    return (
      draft.quantity !== String(charge.quantity ?? 1) ||
      draft.unitPrice !== String(charge.unitPrice ?? charge.amount)
    );
  };

  const cancelExtraChargeEdit = (chargeId: string) => {
    setChargeEdits((prev) => {
      const next = { ...prev };
      delete next[chargeId];
      return next;
    });
  };

  const saveExtraChargeEdit = async (charge: BookingCharge) => {
    const draft = chargeEdits[charge.id] ?? getChargeEdit(charge);
    const quantity = Number(draft.quantity);
    const unitPrice = Number(draft.unitPrice);
    if (!quantity || quantity <= 0) return toast.error('Enter a valid quantity');
    if (!unitPrice || unitPrice <= 0) return toast.error('Enter a valid price');

    const updated = recalculateExtraCharge(charge, quantity, unitPrice);
    const unchanged =
      updated.amount === charge.amount &&
      (updated.quantity ?? 1) === (charge.quantity ?? 1) &&
      (updated.unitPrice ?? charge.amount) === (charge.unitPrice ?? charge.amount);
    if (unchanged) {
      setChargeEdits((prev) => {
        const next = { ...prev };
        delete next[charge.id];
        return next;
      });
      return;
    }

    const nextExtras = extraCharges.map((c) => (c.id === charge.id ? updated : c));
    const payId = `pay-${charge.id}`;
    const nextPayments = payments.map((p) =>
      p.id === payId ? { ...p, amount: updated.amount, note: updated.label } : p,
    );
    await persistBill(nextExtras, nextPayments);
    setChargeEdits((prev) => {
      const next = { ...prev };
      delete next[charge.id];
      return next;
    });
    toast.success('Charge updated');
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
    printInvoice();
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
          <>
            <div className="flex w-full items-center gap-2 sm:hidden">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {booking.status === 'Reserved' && (
                <Button size="sm" className="flex-1 gap-1.5" onClick={checkIn}>
                  <LogIn className="h-4 w-4" /> Check In
                </Button>
              )}
              {(booking.status === 'Checked In' || booking.status === 'Reserved') && (
                <Button size="sm" className="flex-1 gap-1.5" onClick={checkOut}>
                  <LogOut className="h-4 w-4" /> Check Out
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInvoiceOpen(true)}>
                    <FileText className="h-4 w-4" /> Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrint}>
                    <Printer className="h-4 w-4" /> Print
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
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
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setInvoiceOpen(true)}
              >
                <FileText className="h-4 w-4" /> Invoice
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </>
        }
      />

      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 lg:hidden">
        <div className="flex flex-wrap gap-1.5">
          <BookingStatusBadge status={booking.status} />
          <PaymentStatusBadge status={status} pending={balance} />
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Due</p>
          <Money value={balance} className="text-base font-semibold" colored={balance > 0} muteZero={false} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="order-2 lg:order-none lg:col-span-2">
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Booking Details</CardTitle>
            <div className="hidden gap-2 sm:flex">
              <BookingStatusBadge status={booking.status} />
              <PaymentStatusBadge status={status} />
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
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

        <Card className="order-1 lg:order-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bill Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={formatRoomTariffLabel(booking)} value={roomTotal} />
            {booking.discount > 0 && <Row label="Discount" value={-booking.discount} />}
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
                {groupExtraChargesForDisplay(extraCharges).map((g) => (
                  <Row
                    key={g.key}
                    label={formatGroupedExtraChargeLabel(g)}
                    value={g.amount}
                  />
                ))}
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
          <CardTitle className="text-base">Discount</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Discount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0"
                disabled={booking.status === 'Checked Out'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyDiscount();
                  }
                }}
              />
            </div>
            {booking.status !== 'Checked Out' && (
              <Button
                onClick={applyDiscount}
                disabled={applyingDiscount}
                className="w-full sm:w-auto"
              >
                Apply
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extra Charges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Item</Label>
              <Select
                value={chargeItemType}
                onValueChange={(v) => setChargeItemType(v as ExtraChargeItemType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXTRA_CHARGE_ITEM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {chargeItemType === 'Other' && (
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={chargeCustomName}
                  onChange={(e) => setChargeCustomName(e.target.value)}
                  placeholder="Item name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExtraCharge();
                    }
                  }}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={chargeQuantity}
                  onChange={(e) => setChargeQuantity(e.target.value)}
                  placeholder="1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExtraCharge();
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={chargeUnitPrice}
                  onChange={(e) => setChargeUnitPrice(e.target.value)}
                  placeholder="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExtraCharge();
                    }
                  }}
                />
              </div>
            </div>
            <div className="col-span-full grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
                        {formatPaymentAccount(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                const edit = getChargeEdit(c);
                const editQty = Number(edit.quantity) || 0;
                const editPrice = Number(edit.unitPrice) || 0;
                const editTotal = editQty > 0 && editPrice > 0 ? round2(editQty * editPrice) : c.amount;
                const dirty = isChargeEditDirty(c);
                return (
                  <div key={c.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2 sm:block">
                        <p className="truncate font-medium">{extraChargeName(c)}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="-mr-1 h-8 w-8 shrink-0 text-destructive sm:hidden"
                          onClick={() => removeExtraCharge(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-end">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Qty</Label>
                          <Input
                            type="number"
                            min={1}
                            className="h-8 w-16 text-xs"
                            value={edit.quantity}
                            onChange={(e) => setChargeEdit(c, 'quantity', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && dirty) {
                                e.preventDefault();
                                saveExtraChargeEdit(c);
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Price (₹)</Label>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20 text-xs"
                            value={edit.unitPrice}
                            onChange={(e) => setChargeEdit(c, 'unitPrice', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && dirty) {
                                e.preventDefault();
                                saveExtraChargeEdit(c);
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Total</Label>
                          <p className="flex h-8 items-center text-sm font-medium">
                            <Money value={editTotal} muteZero={false} />
                          </p>
                        </div>
                        {dirty && (
                          <div className="col-span-3 flex items-end gap-1.5 sm:col-span-1">
                            <Button
                              size="sm"
                              className="h-8 flex-1 sm:flex-none"
                              onClick={() => saveExtraChargeEdit(c)}
                              disabled={update.isPending}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 sm:flex-none"
                              onClick={() => cancelExtraChargeEdit(c.id)}
                              disabled={update.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {paid ? `Paid · ${c.paymentMode} · ${formatPaymentAccount(c.account)}` : 'Pending'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:items-center sm:gap-1.5">
                      {!paid && (
                        <>
                          <Select
                            value={collectMode}
                            onValueChange={(v) =>
                              setCollectModes((prev) => ({ ...prev, [c.id]: v as PaymentMode }))
                            }
                          >
                            <SelectTrigger className="h-9 w-full text-xs sm:h-8 sm:w-[100px]">
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
                            <SelectTrigger className="h-9 w-full text-xs sm:h-8 sm:w-[110px]">
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
                          <Button
                            size="sm"
                            variant="secondary"
                            className="col-span-2 h-9 sm:col-span-1 sm:h-8 sm:w-auto"
                            onClick={() => collectExtraCharge(c)}
                          >
                            Collect {formatINR(c.amount)}
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hidden h-8 w-8 shrink-0 text-destructive sm:inline-flex"
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Room rent collections only — pending extras are collected separately.
            </p>
            <div className="space-y-3 lg:flex lg:flex-wrap lg:items-end lg:gap-3 lg:space-y-0">
              <div className="lg:min-w-[120px] lg:flex-1">
                <Label className="mb-1.5 block text-xs">Amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="₹"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:contents">
                <div className="min-w-0 lg:w-36">
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
                <div className="min-w-0 lg:w-36">
                  <Label className="mb-1.5 block text-xs">Account</Label>
                  <Select value={payAccount} onValueChange={(v) => setPayAccount(v as PaymentAccount)}>
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
                className="w-full lg:w-auto"
                onClick={recordPayment}
                disabled={balance <= 0}
              >
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
                        <Money value={p.amount} muteZero={false} /> · {p.mode} · {formatPaymentAccount(p.account)}
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

      <BookingCheckoutDialog
        booking={booking}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        taxPercent={taxPercent}
      />

      <BookingFormDialog open={editOpen} onOpenChange={setEditOpen} booking={booking} />

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-2xl [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:bg-background [&_[data-slot=dialog-close]]:p-1.5 [&_[data-slot=dialog-close]]:text-foreground [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:shadow-sm">
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
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
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
