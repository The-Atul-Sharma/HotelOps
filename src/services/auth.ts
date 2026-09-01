import { STORAGE_PREFIX } from '@/config/constants';
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase';
import { fromRow } from '@/services/supabaseMapper';
import { getDb } from './db';
import type { User } from '@/types';

const SESSION_KEY = `${STORAGE_PREFIX}:session`;

export function getSessionUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionUserId(userId: string): void {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function findUserByCredentials(
  username: string,
  password: string,
): Promise<User | null> {
  const normalized = username.trim().toLowerCase();
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('users')
      .select('*')
      .ilike('username', normalized)
      .eq('password', password)
      .eq('active', true)
      .maybeSingle();
    if (error || !data) return null;
    return fromRow<User>(data);
  }
  return (
    getDb().users.find(
      (u) =>
        u.active &&
        u.username.toLowerCase() === normalized &&
        u.password === password,
    ) ?? null
  );
}

export async function fetchUserById(id: string): Promise<User | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();
    if (error || !data) return null;
    return fromRow<User>(data);
  }
  return getDb().users.find((u) => u.id === id && u.active) ?? null;
}

export function getUserById(id: string): User | null {
  return getDb().users.find((u) => u.id === id && u.active) ?? null;
}
