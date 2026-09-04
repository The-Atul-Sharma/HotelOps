import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExportPrintActions } from "@/components/shared/ExportPrintActions";
import { PrintableTable } from "@/components/shared/PrintableTable";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { Money } from "@/components/shared/Money";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/shared/ResponsiveModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useExpenses, expenseHooks } from "@/hooks/useEntities";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagination } from "@/hooks/usePagination";
import { useDateRange } from "@/hooks/useDateRange";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { PaginationBar } from "@/components/shared/Pagination";
import { EXPENSE_CATEGORIES, PAYMENT_ACCOUNTS, PAYMENT_MODES, formatPaymentAccount } from "@/config/constants";
import { formatDate, formatINR } from "@/utils/format";
import { inRange } from "@/utils/dateRange";
import { appToday } from '@/lib/dayjs';
import type { Expense, PaymentAccount, PaymentMode, TransactionCategory } from "@/types";

const schema = z
  .object({
    date: z.string().min(1),
    category: z.enum(
      EXPENSE_CATEGORIES as [TransactionCategory, ...TransactionCategory[]],
    ),
    expenseName: z.string().optional(),
    amount: z.coerce.number().positive("Amount must be positive"),
    paymentMode: z.enum(PAYMENT_MODES as [PaymentMode, ...PaymentMode[]]),
    account: z.enum(PAYMENT_ACCOUNTS as [PaymentAccount, ...PaymentAccount[]]),
    remarks: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const name = v.expenseName?.trim() ?? "";
    if (v.category === "STF" && !name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter name of person from where STF came",
        path: ["expenseName"],
      });
    }
    if (v.category === "Other" && !name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the expense name",
        path: ["expenseName"],
      });
    }
  });

type FormValues = z.input<typeof schema>;

const NAME_EDITABLE = new Set<TransactionCategory>(["STF", "Other"]);

function nameLabel(category: TransactionCategory) {
  if (category === "STF") return "Person name";
  if (category === "Other") return "Expense name";
  return "Expense name";
}

function namePlaceholder(category: TransactionCategory) {
  if (category === "STF") return "Name of person from where STF came";
  if (category === "Other") return "Enter expense name";
  return undefined;
}

function emptyForm(): FormValues {
  return {
    date: appToday(),
    category: "Grocery",
    expenseName: "Grocery",
    amount: undefined,
    paymentMode: "Cash",
    account: "None",
    remarks: "",
  };
}

export default function ExpensesPage() {
  const { data: expenses = [], isLoading } = useExpenses();
  const create = expenseHooks.useCreate();
  const update = expenseHooks.useUpdate();
  const remove = expenseHooks.useRemove();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 250);
  const [categoryFilter, setCategoryFilter] = useState<
    TransactionCategory | "ALL"
  >("ALL");
  const { range, resetKey, filterProps } = useDateRange("month");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return expenses
      .filter((e) => inRange(e.date, range))
      .filter((e) =>
        categoryFilter === "ALL" ? true : e.category === categoryFilter,
      )
      .filter((e) =>
        !q
          ? true
          : [e.description, e.category].some((v) =>
              String(v).toLowerCase().includes(q),
            ),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, debounced, categoryFilter, range]);

  const { page, setPage, pageItems, total: pageTotal } = usePagination(
    filtered,
    `${resetKey}|${categoryFilter}|${debounced}`,
  );
  const today = appToday();
  const todayTotal = filtered
    .filter((e) => e.date === today)
    .reduce((s, e) => s + e.amount, 0);
  const total = filtered.reduce((s, e) => s + e.amount, 0);

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

  const selectedCategory = watch("category");
  const nameEditable = NAME_EDITABLE.has(selectedCategory);

  const openAdd = () => {
    setEditing(null);
    reset(emptyForm());
    setOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    const editable = NAME_EDITABLE.has(e.category);
    reset({
      date: e.date,
      category: e.category,
      expenseName: editable ? e.description : e.category,
      amount: e.amount,
      paymentMode: e.paymentMode,
      account: e.account ?? "None",
      remarks: e.remarks ?? "",
    });
    setOpen(true);
  };

  const onSubmit = (v: FormValues) => {
    const category = v.category as TransactionCategory;
    const name = (v.expenseName ?? "").trim();
    const payload = {
      date: v.date,
      category,
      description: NAME_EDITABLE.has(category) ? name : category,
      amount: Number(v.amount),
      paymentMode: v.paymentMode as PaymentMode,
      account: v.account as PaymentAccount,
      remarks: v.remarks?.trim() || undefined,
    } as Omit<Expense, "id" | "createdAt" | "updatedAt">;

    if (editing) {
      update.mutate(
        { id: editing.id, patch: payload },
        {
          onSuccess: () => {
            toast.success("Expense updated");
            setOpen(false);
            setEditing(null);
          },
        },
      );
      return;
    }

    create.mutate(payload, {
      onSuccess: () => {
        toast.success("Expense added");
        reset(emptyForm());
        setOpen(false);
      },
    });
  };

  const del = async (e: Expense) => {
    const ok = await confirm({
      title: `Delete ${e.category} expense?`,
      description: `${formatINR(e.amount)} · ${formatDate(e.date)} · This cannot be undone.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(e.id, { onSuccess: () => toast.success("Expense deleted") });
  };

  const exportRows = useMemo(
    () =>
      filtered.map((e) => ({
        Date: formatDate(e.date),
        Category: e.category,
        "Expense name": e.category === "Other" ? e.description : "—",
        "Person name": e.category === "STF" ? e.description : "—",
        Mode: e.paymentMode,
        Account: formatPaymentAccount(e.account),
        Remark: e.remarks || "—",
        Amount: formatINR(e.amount),
      })),
    [filtered],
  );

  const exportColumns = [
    { key: "Date", label: "Date" },
    { key: "Category", label: "Category" },
    { key: "Expense name", label: "Expense name" },
    { key: "Person name", label: "Person name" },
    { key: "Mode", label: "Mode" },
    { key: "Account", label: "Account" },
    { key: "Remark", label: "Remark" },
    { key: "Amount", label: "Amount", align: "right" as const },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        description="Track daily operating expenses by category."
        actions={
          <div className="flex flex-wrap gap-2">
            <DateRangeFilter {...filterProps} />
            <ExportPrintActions rows={exportRows} filename="expenses" />
            <Button onClick={openAdd} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          </div>
        }
      />

      <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">In Range (Today)</p>
          <p className="mt-1 text-xl font-semibold">
            <Money value={todayTotal} muteZero={false} />
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" /> Range Total
          </p>
          <p className="mt-1 text-xl font-semibold text-destructive">
            <Money value={total} muteZero={false} />
          </p>
        </Card>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses…"
            className="pl-8"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) =>
            setCategoryFilter(v as TransactionCategory | "ALL")
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No expenses found"
          action={<Button onClick={openAdd}>Add expense</Button>}
        />
      ) : (
        <>
          <PrintableTable title="Expenses" columns={exportColumns} rows={exportRows} />
          <div className="no-print overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Expense name</TableHead>
                  <TableHead>Person name</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="no-print text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(e.date)}
                    </TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="font-medium">
                      {e.category === "Other" ? e.description : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {e.category === "STF" ? e.description : "—"}
                    </TableCell>
                    <TableCell>{e.paymentMode}</TableCell>
                    <TableCell>{formatPaymentAccount(e.account)}</TableCell>
                    <TableCell className="max-w-[160px] text-muted-foreground">
                      {e.remarks ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate cursor-default">
                                {e.remarks}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs break-words"
                            >
                              {e.remarks}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={e.amount} />
                    </TableCell>
                    <TableCell className="no-print text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(e)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => del(e)}
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
          <div className="no-print">
            <PaginationBar page={page} total={pageTotal} onPageChange={setPage} />
          </div>
        </>
      )}

      <ResponsiveModal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <ResponsiveModalContent className="flex max-h-[90dvh] max-w-none flex-col sm:max-w-lg">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {editing ? "Edit Expense" : "Add Expense"}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <ResponsiveModalBody className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Date" error={errors.date?.message} className="min-w-0">
                <Input type="date" {...register("date")} />
              </F>
              <F label="Category" className="min-w-0">
                <Select
                  value={watch("category")}
                  onValueChange={(v) => {
                    const cat = v as TransactionCategory;
                    setValue("category", cat);
                    setValue(
                      "expenseName",
                      NAME_EDITABLE.has(cat) ? "" : cat,
                    );
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
            </div>
            <F
              label={nameLabel(selectedCategory)}
              error={errors.expenseName?.message}
            >
              <Input
                {...register("expenseName")}
                disabled={!nameEditable}
                placeholder={namePlaceholder(selectedCategory)}
                className="disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-100"
              />
            </F>
            <F label="Amount (₹)" error={errors.amount?.message}>
              <Input type="number" inputMode="decimal" {...register("amount")} />
            </F>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Payment Mode" className="min-w-0">
                <Select
                  value={watch("paymentMode")}
                  onValueChange={(v) => {
                    const mode = v as PaymentMode;
                    setValue("paymentMode", mode);
                    if (mode === "Cash") setValue("account", "None");
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
              </F>
              <F label="Account" className="min-w-0">
                <Select
                  value={watch("account")}
                  onValueChange={(v) => setValue("account", v as PaymentAccount)}
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
              </F>
            </div>
            <F label="Remark">
              <Input {...register("remarks")} placeholder="Optional" />
            </F>
            </ResponsiveModalBody>
            <ResponsiveModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editing ? "Save Changes" : "Add Expense"}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>
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
