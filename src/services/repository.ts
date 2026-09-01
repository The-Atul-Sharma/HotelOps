import { getDb, persist, type Database } from './db';
import { uid } from '@/utils/id';

const LATENCY = 120;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY));
}

export interface Entity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EntityRepository<T extends Entity> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
  bulkCreate(items: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>>): Promise<T[]>;
  replaceAll(items: T[]): Promise<T[]>;
}

type CollectionKey = {
  [K in keyof Database]: Database[K] extends Array<infer T>
    ? T extends Entity
      ? K
      : never
    : never;
}[keyof Database];

export class Repository<T extends Entity> implements EntityRepository<T> {
  constructor(
    private key: CollectionKey,
    private idPrefix = '',
  ) {}

  private col(): T[] {
    const db = getDb();
    if (!Array.isArray(db[this.key])) {
      Object.assign(db, { [this.key]: [] });
      persist();
    }
    return db[this.key] as unknown as T[];
  }

  async list(): Promise<T[]> {
    return delay([...this.col()]);
  }

  async get(id: string): Promise<T | undefined> {
    return delay(this.col().find((x) => x.id === id));
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>): Promise<T> {
    const now = new Date().toISOString();
    const entity = {
      ...data,
      id: data.id ?? uid(this.idPrefix),
      createdAt: now,
      updatedAt: now,
    } as unknown as T;
    this.col().unshift(entity);
    persist();
    return delay(entity);
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const col = this.col();
    const idx = col.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error(`${this.key} ${id} not found`);
    const updated = { ...col[idx], ...patch, updatedAt: new Date().toISOString() } as T;
    col[idx] = updated;
    persist();
    return delay(updated);
  }

  async remove(id: string): Promise<void> {
    const col = this.col();
    const idx = col.findIndex((x) => x.id === id);
    if (idx !== -1) {
      col.splice(idx, 1);
      persist();
    }
    return delay(undefined);
  }

  async bulkCreate(items: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>>): Promise<T[]> {
    const created: T[] = [];
    const now = new Date().toISOString();
    for (const data of items) {
      const entity = {
        ...data,
        id: data.id ?? uid(this.idPrefix),
        createdAt: now,
        updatedAt: now,
      } as unknown as T;
      this.col().unshift(entity);
      created.push(entity);
    }
    persist();
    return delay(created);
  }

  async replaceAll(items: T[]): Promise<T[]> {
    const db = getDb();
    (db[this.key] as unknown as T[]).length = 0;
    (db[this.key] as unknown as T[]).push(...items);
    persist();
    return delay(items);
  }
}
