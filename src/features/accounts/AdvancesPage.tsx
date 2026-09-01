import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, HandCoins, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, EmptyState } from '@/components/shared/states';
import { Money } from '@/components/shared/Money';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { PaginationBar } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdvances, advanceHooks } from '@/hooks/useEntities';
import { usePagination } from '@/hooks/usePagination';
import { useDateRange } from '@/hooks/useDateRange';
import { ADVANCE_TYPES, PAYMENT_MODES } from '@/config/constants';
import { round2 } from '@/utils/finance';
import { formatDate, formatINR } from '@/utils/format';
import { inRange } from '@/utils/dateRange';
import dayjs from 'dayjs';
import type { Advance, AdvanceType, PaymentMode } from '@/types';

const schema = z.object({
  date: z.string().min(1),
  person: z.string().min(1, 'Person/party is required'),
  type: z.enum(ADVANCE_TYPES as [AdvanceType, ...AdvanceType[]]),
  amount: z.coerce.number().positive('Amount must be positive'),
  purpose: z.string().optional(),
  paymentMode: z.enum(PAYMENT_MODES as [PaymentMode, ...PaymentMode[]]),
});
type FormValues = z.input<typeof schema>;

const emptyForm = (): FormValues => ({
  date: dayjs().format('YYYY-MM-DD'),
  type: 'Staff',
  amount: undefined,
  paymentMode: 'Cash',
  person: '',
  purpose: '',
});

export default function AdvancesPage() {
  const { data: advances = [], isLoading } = useAdvances();
  const create = advanceHooks.useCreate();
  const update = advanceHooks.useUpdate();
  const remove = advanceHooks.useRemove();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Advance | null>(null);
  const { range, resetKey, filterProps } = useDateRange('month');

  const filtered = useMemo(
    () => advances.filter((a) => inRange(a.date, range)),
    [advances, range],
  );

  const { page, setPage, pageItems, total: pageTotal } = usePagination(
    filtered,
    resetKey,
  );
  const totalGiven = useMemo(
    () => round2(filtered.reduce((s, a) => s + a.amount, 0)),
    [filtered],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(),
  });

  const openAdd = () => {
    setEditing(null);
    reset(emptyForm());
    setOpen(true);
  };

  const openEdit = (a: Advance) => {
    setEditing(a);
    reset({
      date: a.date,
      person: a.person,
      type: a.type,
      amount: a.amount,
      purpose: a.purpose ?? '',
      paymentMode: a.paymentMode ?? 'Cash',
    });
    setOpen(true);
  };

  const onSubmit = (v: FormValues) => {
    const amount = Number(v.amount);
    const payload = {
      date: v.date,
      person: v.person,
      type: v.type as AdvanceType,
      amount,
      purpose: v.purpose,
      paymentMode: v.paymentMode as PaymentMode,
      recoveredAmount: editing?.recoveredAmount ?? 0,
      remainingAmount: amount,
      status: editing?.status ?? 'Open',
    } as Omit<Advance, 'id' | 'createdAt' | 'updatedAt'>;

    if (editing) {
      update.mutate(
        { id: editing.id, patch: payload },
        {
          onSuccess: () => {
            toast.success('Advance updated');
            setOpen(false);
            setEditing(null);
          },
        },
      );
      return;
    }

    create.mutate(payload, {
      onSuccess: () => {
        toast.success('Advance recorded');
        reset(emptyForm());
        setOpen(false);
      },
    });
  };

  const del = async (a: Advance) => {
    const ok = await confirm({
      title: `Delete advance for ${a.person}?`,
      description: `${a.type} · ${formatINR(a.amount)} · This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(a.id, { onSuccess: () => toast.success('Advance deleted') });
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Advances"
        description="Track advances given to staff and owner."
        actions={
          <div className="flex flex-wrap gap-2">
            <DateRangeFilter {...filterProps} />
            <Button onClick={openAdd} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Advance
            </Button>
          </div>
        }
      />

      <Card className="p-4 sm:max-w-xs">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HandCoins className="h-3.5 w-3.5" /> Total Advances
        </p>
        <p className="mt-1 text-xl font-semibold">
          <Money value={totalGiven} muteZero={false} />
        </p>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="No advances in this range" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(a.date)}</TableCell>
                    <TableCell className="font-medium">{a.person}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>{a.purpose || '—'}</TableCell>
                    <TableCell>{a.paymentMode ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Money value={a.amount} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => del(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={page} total={pageTotal} onPageChange={setPage} />
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Advance' : 'Add Advance'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <F label="Date" error={errors.date?.message}>
              <Input type="date" {...register('date')} />
            </F>
            <F label="Type">
              <Select value={watch('type')} onValueChange={(v) => setValue('type', v as AdvanceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVANCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </F>
            <F label="Person / Party" error={errors.person?.message} className="col-span-2">
              <Input {...register('person')} />
            </F>
            <F label="Amount (₹)" error={errors.amount?.message}>
              <Input type="number" {...register('amount')} />
            </F>
            <F label="Payment Mode">
              <Select
                value={watch('paymentMode')}
                onValueChange={(v) => setValue('paymentMode', v as PaymentMode)}
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
            </F>
            <F label="Purpose" className="col-span-2">
              <Input {...register('purpose')} />
            </F>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Add Advance'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({
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
