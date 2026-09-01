import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishKey = import.meta.env.VITE_SUPABASE_PUBLISH_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && publishKey);
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !publishKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISH_KEY.',
    );
  }
  if (!client) {
    client = createClient(url, publishKey);
  }
  return client;
}
