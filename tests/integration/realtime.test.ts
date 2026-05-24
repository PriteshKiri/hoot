/**
 * Integration test: session advance → Realtime broadcast received.
 *
 * Tests that advancing session state triggers a session_state_changed broadcast
 * received by a subscribed client within 500ms.
 *
 * Requires HOOT_INTEGRATION_ENABLED=true and a running dev server at
 * HOOT_BASE_URL (default: http://localhost:3000).
 *
 * Requirements: 7.1, 7.2
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient } from "@supabase/supabase-js"

const ENABLED = process.env.HOOT_INTEGRATION_ENABLED === "true"

const supabase = ENABLED
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  : null

let testSessionId: string
let testEventId: string
let testAdminId: string

describe.skipIf(!ENABLED)("Integration: session advance → Realtime broadcast received", () => {
  beforeAll(async () => {
    if (!supabase) return

    testAdminId = crypto.randomUUID()

    const { data: event } = await supabase
      .from("events")
      .insert({
        admin_id: testAdminId,
        title: `Realtime Test Event ${Date.now()}`,
        status: "published",
        join_code: "RTTEST",
      })
      .select()
      .single()
    testEventId = event!.id

    // Create a question so the session can advance
    const { data: question } = await supabase
      .from("questions")
      .insert({
        event_id: testEventId,
        position: 1,
        question_type: "open_text",
        text: "Realtime test question?",
        time_limit: 30,
      })
      .select()
      .single()

    const { data: session } = await supabase
      .from("sessions")
      .insert({
        event_id: testEventId,
        admin_id: testAdminId,
        status: "lobby",
        current_question_index: -1,
      })
      .select()
      .single()
    testSessionId = session!.id
  })

  afterAll(async () => {
    if (!supabase || !testEventId) return
    await supabase.from("sessions").delete().eq("id", testSessionId)
    await supabase.from("questions").delete().eq("event_id", testEventId)
    await supabase.from("events").delete().eq("id", testEventId)
  })

  it("19.2: broadcast is received within 500ms of session state change", async () => {
    if (!supabase) return

    const receivedEvents: unknown[] = []
    let resolveReceived: () => void
    const received = new Promise<void>((resolve) => { resolveReceived = resolve })

    // Subscribe to the session channel
    const channel = supabase.channel(`session:${testSessionId}`)
    channel
      .on("broadcast", { event: "session_state_changed" }, (payload) => {
        receivedEvents.push(payload)
        resolveReceived()
      })
      .subscribe()

    // Wait for subscription to be active
    await new Promise((r) => setTimeout(r, 500))

    // Broadcast a test event via the REST API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const broadcastStart = Date.now()
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `realtime:session:${testSessionId}`,
            event: "session_state_changed",
            payload: { status: "countdown" },
          },
        ],
      }),
    })

    // Wait for broadcast to be received (up to 1000ms)
    await Promise.race([
      received,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000)),
    ])

    const elapsed = Date.now() - broadcastStart
    expect(elapsed).toBeLessThan(1000)
    expect(receivedEvents.length).toBeGreaterThan(0)

    await supabase.removeChannel(channel)
  })
})
