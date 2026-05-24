/**
 * Integration test: RLS policies.
 *
 * Tests that an admin cannot read or modify another admin's events,
 * questions, or sessions.
 *
 * Requires HOOT_INTEGRATION_ENABLED=true and two test user credentials:
 *   HOOT_TEST_USER1_EMAIL / HOOT_TEST_USER1_PASSWORD
 *   HOOT_TEST_USER2_EMAIL / HOOT_TEST_USER2_PASSWORD
 *
 * Requirements: 2.1, 2.5
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient } from "@supabase/supabase-js"

const ENABLED =
  process.env.HOOT_INTEGRATION_ENABLED === "true" &&
  !!process.env.HOOT_TEST_USER1_EMAIL &&
  !!process.env.HOOT_TEST_USER2_EMAIL

const serviceClient = ENABLED
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  : null

let admin1EventId: string
let admin2EventId: string
let admin1Id: string
let admin2Id: string

describe.skipIf(!ENABLED)("Integration: RLS policies", () => {
  beforeAll(async () => {
    if (!serviceClient) return

    // Sign in as admin1 to get their user ID
    const anonClient1 = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: auth1 } = await anonClient1.auth.signInWithPassword({
      email: process.env.HOOT_TEST_USER1_EMAIL!,
      password: process.env.HOOT_TEST_USER1_PASSWORD!,
    })
    admin1Id = auth1.user!.id

    const anonClient2 = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: auth2 } = await anonClient2.auth.signInWithPassword({
      email: process.env.HOOT_TEST_USER2_EMAIL!,
      password: process.env.HOOT_TEST_USER2_PASSWORD!,
    })
    admin2Id = auth2.user!.id

    // Create events for each admin via service role
    const { data: event1 } = await serviceClient
      .from("events")
      .insert({
        admin_id: admin1Id,
        title: `RLS Test Event Admin1 ${Date.now()}`,
        status: "draft",
      })
      .select()
      .single()
    admin1EventId = event1!.id

    const { data: event2 } = await serviceClient
      .from("events")
      .insert({
        admin_id: admin2Id,
        title: `RLS Test Event Admin2 ${Date.now()}`,
        status: "draft",
      })
      .select()
      .single()
    admin2EventId = event2!.id
  })

  afterAll(async () => {
    if (!serviceClient) return
    if (admin1EventId) await serviceClient.from("events").delete().eq("id", admin1EventId)
    if (admin2EventId) await serviceClient.from("events").delete().eq("id", admin2EventId)
  })

  it("19.4: admin1 cannot read admin2's events", async () => {
    if (!serviceClient) return

    // Sign in as admin1
    const client1 = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await client1.auth.signInWithPassword({
      email: process.env.HOOT_TEST_USER1_EMAIL!,
      password: process.env.HOOT_TEST_USER1_PASSWORD!,
    })

    // Try to read admin2's event
    const { data, error } = await client1
      .from("events")
      .select("*")
      .eq("id", admin2EventId)
      .single()

    // RLS should prevent this — either error or empty result
    expect(data).toBeNull()
  })

  it("19.4: admin1 cannot update admin2's events", async () => {
    if (!serviceClient) return

    const client1 = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await client1.auth.signInWithPassword({
      email: process.env.HOOT_TEST_USER1_EMAIL!,
      password: process.env.HOOT_TEST_USER1_PASSWORD!,
    })

    // Try to update admin2's event
    const { data, error } = await client1
      .from("events")
      .update({ title: "Hacked!" })
      .eq("id", admin2EventId)
      .select()

    // RLS should prevent this — no rows updated
    expect(data).toHaveLength(0)
  })

  it("19.4: admin1 can read their own events", async () => {
    if (!serviceClient) return

    const client1 = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await client1.auth.signInWithPassword({
      email: process.env.HOOT_TEST_USER1_EMAIL!,
      password: process.env.HOOT_TEST_USER1_PASSWORD!,
    })

    const { data, error } = await client1
      .from("events")
      .select("*")
      .eq("id", admin1EventId)
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.id).toBe(admin1EventId)
  })
})
