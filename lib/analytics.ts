import { createServiceClient } from "@/lib/supabase/service"

/**
 * Generates analytics snapshots for all questions in a session.
 *
 * Called when a session transitions to 'ended' state.
 * Computes per-question:
 *   - total_responses: number of participants who answered
 *   - option_counts: { optionId, count, percentage }[] for choice questions
 *   - avg_response_time_ms: average response time across all answers
 *
 * Upserts into analytics_snapshots table.
 *
 * Requirements: 13.1, 13.2
 */
export async function generateAnalyticsSnapshots(sessionId: string): Promise<void> {
  const supabase = createServiceClient()

  // Fetch session with event questions
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(`
      id,
      event_id,
      events (
        questions (
          id,
          question_type,
          answer_options (
            id
          )
        )
      )
    `)
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) return

  const eventsRelation = session.events as unknown as {
    questions: Array<{
      id: string
      question_type: string
      answer_options: Array<{ id: string }>
    }>
  } | null

  const questions = eventsRelation?.questions ?? []
  if (questions.length === 0) return

  // Fetch all answers for this session
  const { data: answers, error: answersError } = await supabase
    .from("participant_answers")
    .select("question_id, selected_option_ids, response_time_ms")
    .eq("session_id", sessionId)

  if (answersError) return

  const answersByQuestion = new Map<string, Array<{
    selected_option_ids: string[] | null
    response_time_ms: number | null
  }>>()

  for (const answer of answers ?? []) {
    const qId = answer.question_id as string
    if (!answersByQuestion.has(qId)) {
      answersByQuestion.set(qId, [])
    }
    answersByQuestion.get(qId)!.push({
      selected_option_ids: answer.selected_option_ids as string[] | null,
      response_time_ms: answer.response_time_ms as number | null,
    })
  }

  // Build snapshot rows
  const snapshots = questions.map((question) => {
    const qAnswers = answersByQuestion.get(question.id) ?? []
    const totalResponses = qAnswers.length

    // Compute option counts for choice questions
    const optionCounts: Array<{ optionId: string; count: number; percentage: number }> = []
    if (
      question.question_type === "single_select" ||
      question.question_type === "multi_select" ||
      question.question_type === "image_choice"
    ) {
      const countMap = new Map<string, number>()
      for (const opt of question.answer_options) {
        countMap.set(opt.id, 0)
      }
      for (const answer of qAnswers) {
        for (const optId of answer.selected_option_ids ?? []) {
          countMap.set(optId, (countMap.get(optId) ?? 0) + 1)
        }
      }
      for (const [optionId, count] of Array.from(countMap.entries())) {
        const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0
        optionCounts.push({ optionId, count, percentage })
      }
    }

    // Compute average response time
    const responseTimes = qAnswers
      .map((a) => a.response_time_ms)
      .filter((t): t is number => t !== null && t !== undefined)
    const avgResponseTimeMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
        : null

    return {
      session_id: sessionId,
      question_id: question.id,
      total_responses: totalResponses,
      option_counts: optionCounts,
      avg_response_time_ms: avgResponseTimeMs,
    }
  })

  // Upsert snapshots
  if (snapshots.length > 0) {
    await supabase
      .from("analytics_snapshots")
      .upsert(snapshots, { onConflict: "session_id,question_id" })
  }
}

/**
 * Generates a CSV export for a session.
 *
 * Columns: participant display_name, score per question (or blank if not answered), total_score
 * Rows sorted by total_score descending.
 *
 * Requirements: 13.3
 */
export async function generateSessionCsv(sessionId: string): Promise<string> {
  const supabase = createServiceClient()

  // Fetch session with questions
  const { data: session } = await supabase
    .from("sessions")
    .select(`
      id,
      events (
        title,
        questions (
          id,
          position,
          text
        )
      )
    `)
    .eq("id", sessionId)
    .single()

  const eventsRelation = (session?.events as unknown as {
    title: string
    questions: Array<{ id: string; position: number; text: string }>
  } | null)

  const questions = (eventsRelation?.questions ?? []).sort((a, b) => a.position - b.position)

  // Fetch participants sorted by total_score desc
  const { data: participants } = await supabase
    .from("session_participants")
    .select("id, display_name, total_score")
    .eq("session_id", sessionId)
    .order("total_score", { ascending: false })

  // Fetch all answers
  const { data: answers } = await supabase
    .from("participant_answers")
    .select("participant_id, question_id, score_awarded")
    .eq("session_id", sessionId)

  // Build answer lookup: participantId → questionId → score
  const answerMap = new Map<string, Map<string, number>>()
  for (const answer of answers ?? []) {
    const pId = answer.participant_id as string
    const qId = answer.question_id as string
    if (!answerMap.has(pId)) answerMap.set(pId, new Map())
    answerMap.get(pId)!.set(qId, answer.score_awarded as number)
  }

  // Build CSV
  const escapeCsv = (val: string | number | null | undefined): string => {
    const str = String(val ?? "")
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headers = [
    "Participant",
    ...questions.map((q) => escapeCsv(`Q${q.position}: ${q.text.slice(0, 30)}`)),
    "Total Score",
  ]

  const rows = (participants ?? []).map((p) => {
    const pAnswers = answerMap.get(p.id) ?? new Map()
    const scores = questions.map((q) => {
      const score = pAnswers.get(q.id)
      return score !== undefined ? String(score) : ""
    })
    return [escapeCsv(p.display_name), ...scores, String(p.total_score)]
  })

  const lines = [headers.join(","), ...rows.map((r) => r.join(","))]
  return lines.join("\n")
}
