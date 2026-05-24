import { createClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase client using the service role key.
 *
 * This client bypasses Row-Level Security (RLS) and should only be used
 * in server-side API routes that handle unauthenticated participant actions
 * (join, answer submission, etc.).
 *
 * NEVER expose this client or the service role key to the browser.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
