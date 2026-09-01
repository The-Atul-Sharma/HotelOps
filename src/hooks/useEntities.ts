import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  roomService,
  guestService,
  bookingService,
  transactionService,
  expenseService,
  supplierService,
  advanceService,
  notificationService,
  inventoryService,
  userService,
  settingsService,
  auditService,
  getAuditActorName,
  ENTITY_AUDIT_LABELS,
} from '@/services/api';
import type {
  Room,
  Guest,
  Booking,
  Transaction,
  Expense,
  Supplier,
  Advance,
  AppNotification,
  InventoryItem,
  HotelSettings,
  AuditLogEntry,
  User,
} from '@/types';
import type { Entity, EntityRepository } from '@/services/repository';

const SKIP_AUDIT = new Set(['notifications']);

const IGNORE_AUDIT_KEYS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'payments',
  'extraCharges',
  'password',
]);

const FIELD_LABELS: Record<string, string> = {
  guestName: 'Guest',
  guestId: 'Guest',
  roomNumber: 'Room',
  roomId: 'Room',
  roomType: 'Room type',
  roomRate: 'Rate',
  checkInDate: 'Check-in',
  checkOutDate: 'Check-out',
  checkInTime: 'Check-in time',
  checkOutTime: 'Check-out time',
  totalAmount: 'Total',
  paidAmount: 'Paid',
  balanceAmount: 'Balance',
  advanceReceived: 'Advance',
  paymentMode: 'Payment mode',
  paymentStatus: 'Payment status',
  taxPercent: 'Tax %',
  taxAmount: 'Tax',
  foodAmount: 'Food',
  roomService: 'Room service',
  otherCharges: 'Other charges',
  roomAmount: 'Room amount',
  recoveredAmount: 'Recovered',
  remainingAmount: 'Remaining',
  currentStock: 'Stock',
  totalPaid: 'Total paid',
  voided: 'Voided',
  mobile: 'Mobile',
  email: 'Email',
  status: 'Status',
  amount: 'Amount',
  role: 'Role',
  name: 'Name',
  person: 'Person',
  purpose: 'Purpose',
  description: 'Description',
  particulars: 'Particulars',
  category: 'Category',
  notes: 'Notes',
  remarks: 'Remarks',
  code: 'Code',
  nights: 'Nights',
  adults: 'Adults',
  children: 'Children',
  discount: 'Discount',
  username: 'Username',
  active: 'Active',
  number: 'Number',
  floor: 'Floor',
  type: 'Type',
  rate: 'Rate',
};

const CREATE_SUMMARY_KEYS = [
  'code',
  'guestName',
  'roomNumber',
  'name',
  'person',
  'description',
  'particulars',
  'category',
  'amount',
  'totalAmount',
  'status',
  'role',
  'number',
] as const;

function entityLabel(key: string) {
  return ENTITY_AUDIT_LABELS[key] ?? key;
}

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return String(a) === String(b);
}

function formatAuditValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? String(value)
      : value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none';
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'object') return 'updated';
  return String(value);
}

function summarizeCreate(
  data: Record<string, unknown>,
): Pick<AuditLogEntry, 'field' | 'oldValue' | 'newValue'> {
  const parts: string[] = [];
  for (const key of CREATE_SUMMARY_KEYS) {
    const value = data[key];
    if (value == null || value === '') continue;
    if (key === 'roomNumber') parts.push(`Room ${formatAuditValue(value)}`);
    else if (key === 'amount' || key === 'totalAmount')
      parts.push(`₹${formatAuditValue(value)}`);
    else parts.push(formatAuditValue(value));
    if (parts.length >= 3) break;
  }
  if (parts.length === 0) return {};
  return { field: parts.join(' · ') };
}

function summarizeDiff(
  previous: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): Pick<AuditLogEntry, 'field' | 'oldValue' | 'newValue'> {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

  for (const key of Object.keys(patch)) {
    if (IGNORE_AUDIT_KEYS.has(key)) continue;
    const next = patch[key];
    const prev = previous?.[key];
    if (valuesEqual(prev, next)) continue;
    changes.push({
      field: key,
      oldValue: formatAuditValue(prev),
      newValue: formatAuditValue(next),
    });
  }

  if (changes.length === 0) return { field: 'No field changes' };
  if (changes.length === 1) {
    const only = changes[0];
    return {
      field: fieldLabel(only.field),
      oldValue: only.oldValue,
      newValue: only.newValue,
    };
  }

  const priority = [
    'status',
    'guestName',
    'roomNumber',
    'checkInDate',
    'checkOutDate',
    'totalAmount',
    'paidAmount',
    'balanceAmount',
    'amount',
    'paymentStatus',
    'paymentMode',
    'voided',
    'role',
    'taxPercent',
  ];
  changes.sort((a, b) => {
    const ai = priority.indexOf(a.field);
    const bi = priority.indexOf(b.field);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const shown = changes.slice(0, 4);
  const extra = changes.length - shown.length;
  const summary = shown
    .map((c) => `${fieldLabel(c.field)}: ${c.oldValue} → ${c.newValue}`)
    .join(' · ');
  return {
    field: extra > 0 ? `${summary} · +${extra} more` : summary,
  };
}

async function writeAudit(
  action: AuditLogEntry['action'],
  key: string,
  entityId: string,
  extra?: Pick<AuditLogEntry, 'field' | 'oldValue' | 'newValue'>,
) {
  if (SKIP_AUDIT.has(key)) return;
  await auditService.log({
    user: getAuditActorName(),
    action,
    entity: entityLabel(key),
    entityId,
    ...extra,
  });
}

function createEntityHooks<T extends Entity>(key: string, repo: EntityRepository<T>) {
  const useList = () => useQuery({ queryKey: [key], queryFn: () => repo.list() });

  const useCreate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>) => {
        const created = await repo.create(data);
        await writeAudit(
          'create',
          key,
          created.id,
          summarizeCreate(created as unknown as Record<string, unknown>),
        );
        return created;
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [key] });
        qc.invalidateQueries({ queryKey: ['audit'] });
      },
    });
  };

  const useUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: Partial<T> }) => {
        const previous = await repo.get(id);
        const updated = await repo.update(id, patch);
        const patchRecord = patch as Record<string, unknown>;
        const action: AuditLogEntry['action'] =
          patchRecord.voided === true ? 'void' : 'update';
        await writeAudit(
          action,
          key,
          id,
          summarizeDiff(previous as unknown as Record<string, unknown> | undefined, patchRecord),
        );
        return updated;
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [key] });
        qc.invalidateQueries({ queryKey: ['audit'] });
      },
    });
  };

  const useRemove = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const previous = await repo.get(id);
        await repo.remove(id);
        await writeAudit(
          'delete',
          key,
          id,
          previous
            ? summarizeCreate(previous as unknown as Record<string, unknown>)
            : undefined,
        );
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [key] });
        qc.invalidateQueries({ queryKey: ['audit'] });
      },
    });
  };

  return { useList, useCreate, useUpdate, useRemove, key };
}

export const roomHooks = createEntityHooks<Room>('rooms', roomService);
export const guestHooks = createEntityHooks<Guest>('guests', guestService);
export const bookingHooks = createEntityHooks<Booking>('bookings', bookingService);
export const transactionHooks = createEntityHooks<Transaction>('transactions', transactionService);
export const expenseHooks = createEntityHooks<Expense>('expenses', expenseService);
export const supplierHooks = createEntityHooks<Supplier>('suppliers', supplierService);
export const advanceHooks = createEntityHooks<Advance>('advances', advanceService);
export const notificationHooks = createEntityHooks<AppNotification>(
  'notifications',
  notificationService,
);
export const inventoryHooks = createEntityHooks<InventoryItem>('inventory', inventoryService);
export const userHooks = createEntityHooks<User>('users', userService);

export const useRooms = roomHooks.useList;
export const useGuests = guestHooks.useList;
export const useBookings = bookingHooks.useList;
export const useTransactions = transactionHooks.useList;
export const useExpenses = expenseHooks.useList;
export const useSuppliers = supplierHooks.useList;
export const useAdvances = advanceHooks.useList;
export const useNotifications = notificationHooks.useList;
export const useInventory = inventoryHooks.useList;
export const useUsers = userHooks.useList;
export const useCreateUser = userHooks.useCreate;
export const useUpdateUser = userHooks.useUpdate;
export const useRemoveUser = userHooks.useRemove;

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => settingsService.get() });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<HotelSettings>) => {
      const previous = await settingsService.get();
      const updated = await settingsService.update(patch);
      await writeAudit(
        'update',
        'settings',
        'settings',
        summarizeDiff(
          previous as unknown as Record<string, unknown>,
          patch as Record<string, unknown>,
        ),
      );
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useAuditLog() {
  return useQuery({ queryKey: ['audit'], queryFn: () => auditService.list() });
}
