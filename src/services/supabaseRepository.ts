import { getSupabase } from '@/lib/supabase';
import { uid } from '@/utils/id';
import type { Entity, EntityRepository } from './repository';
import { fromRow, prepareRow, TABLE_META, TABLE_NAMES, type SupabaseCollectionKey } from './supabaseMapper';

const LATENCY = 80;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY));
}

const ORDER_ASCENDING: Partial<Record<SupabaseCollectionKey, boolean>> = {
  users: true,
  inventory: true,
};

export class SupabaseRepository<T extends Entity> implements EntityRepository<T> {
  constructor(
    private key: SupabaseCollectionKey,
    private idPrefix = '',
  ) {}

  private table(): string {
    return TABLE_NAMES[this.key];
  }

  private orderColumn(): string {
    return TABLE_META[this.key].orderBy;
  }

  async list(): Promise<T[]> {
    const ascending = ORDER_ASCENDING[this.key] ?? false;
    const { data, error } = await getSupabase()
      .from(this.table())
      .select('*')
      .order(this.orderColumn(), { ascending });
    if (error) throw error;
    return delay((data ?? []).map((row) => fromRow<T>(row)));
  }

  async get(id: string): Promise<T | undefined> {
    const { data, error } = await getSupabase()
      .from(this.table())
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return delay(data ? fromRow<T>(data) : undefined);
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>): Promise<T> {
    const now = new Date().toISOString();
    const entity = {
      ...data,
      id: data.id ?? uid(this.idPrefix),
      createdAt: now,
      updatedAt: now,
    } as unknown as T;
    const row = prepareRow(this.key, entity as Record<string, unknown>);
    const { error } = await getSupabase().from(this.table()).insert(row);
    if (error) throw error;
    return delay(entity);
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`${this.key} ${id} not found`);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() } as T;
    const row = prepareRow(this.key, updated as Record<string, unknown>);
    const { error } = await getSupabase().from(this.table()).update(row).eq('id', id);
    if (error) throw error;
    return delay(updated);
  }

  async remove(id: string): Promise<void> {
    const { error } = await getSupabase().from(this.table()).delete().eq('id', id);
    if (error) throw error;
    return delay(undefined);
  }

  async bulkCreate(items: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>>): Promise<T[]> {
    const now = new Date().toISOString();
    const created = items.map((data) => ({
      ...data,
      id: data.id ?? uid(this.idPrefix),
      createdAt: now,
      updatedAt: now,
    })) as unknown as T[];
    const rows = created.map((item) => prepareRow(this.key, item as Record<string, unknown>));
    const { error } = await getSupabase().from(this.table()).insert(rows);
    if (error) throw error;
    return delay(created);
  }

  async replaceAll(items: T[]): Promise<T[]> {
    const { error: deleteError } = await getSupabase()
      .from(this.table())
      .delete()
      .neq('id', '');
    if (deleteError) throw deleteError;
    if (items.length === 0) return delay([]);
    const rows = items.map((item) => prepareRow(this.key, item as Record<string, unknown>));
    const { error } = await getSupabase().from(this.table()).insert(rows);
    if (error) throw error;
    return delay(items);
  }
}
