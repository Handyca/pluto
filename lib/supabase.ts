/**
 * Supabase client helpers.
 *
 * Browser client  – uses the public anon key, safe to expose.
 * Server client   – uses the service-role key, NEVER sent to the browser.
 *                   Only import this in API routes / server code.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ── Browser singleton ──────────────────────────────────────────────────────

let _browserClient: SupabaseClient | null = null;

/**
 * Returns a shared Supabase client for browser (realtime subscriptions).
 * Must only be called in a browser context.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!_browserClient) {
    _browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    });
  }
  return _browserClient;
}

// ── Server client (API routes only) ───────────────────────────────────────

/**
 * Creates a one-off Supabase admin client for server-side use.
 * Uses the service-role key — never call this on the client.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
