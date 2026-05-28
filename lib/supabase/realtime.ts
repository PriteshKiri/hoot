/**
 * Broadcasts a Realtime event to a session channel via the Supabase
 * Realtime REST endpoint.
 *
 * The supabase-js client subscribes to topic `realtime:<channel>` under the
 * hood, and the REST broadcast endpoint prepends the `realtime:` prefix
 * automatically — so the `topic` field passed here MUST NOT contain it.
 *
 * Using the REST endpoint avoids needing an active WebSocket subscription
 * from the server (which doesn't play well with stateless route handlers).
 */
export async function broadcastSessionEvent(
  sessionId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return

  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `session:${sessionId}`,
            event,
            payload,
            private: false,
          },
        ],
      }),
    })
  } catch {
    // Broadcasts are best-effort — never fail the API call because of one.
  }
}
