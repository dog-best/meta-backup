import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Admin client (service role) for server-side operations.
 *
 * IMPORTANT:
 * - Never expose SUPABASE_SERVICE_ROLE_KEY in the Expo app.
 * - Use only inside Edge Functions.
 */
export const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Create a user-scoped Supabase client (RLS enforced) using the caller JWT.
 */
export function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
    }
  );
}
