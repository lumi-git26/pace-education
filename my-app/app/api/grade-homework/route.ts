import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const { submissionId } = await request.json();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: submission, error: fetchErr } = await supabase
    .from("homework_submissions")
    .select("id, content, learner_id, assignment_id, classroom_assignments(title, instructions)")
    .eq("id", submissionId)
    .single();

  if (fetchErr || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.learner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const assignment: any = submission.classroom_assignments;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are grading a student homework submission. Respond ONLY with JSON in the form {"score": number (0-100), "feedback": string (2-4 sentences, constructive, specific)}.

Assignment: ${assignment?.title ?? "Untitled"}
Instructions: ${assignment?.instructions ?? "None provided"}

Student submission:
${submission.content}`,
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    return NextResponse.json({ error: "AI grading failed" }, { status: 502 });
  }

  const aiData = await anthropicRes.json();
  const rawText = aiData.content?.[0]?.text ?? "{}";

  let parsed: { score: number; feedback: string };
  try {
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 502 });
  }

  const { error: updateErr } = await supabase
    .from("homework_submissions")
    .update({
      ai_score: parsed.score,
      ai_feedback: parsed.feedback,
      status: "ai_reviewed",
    })
    .eq("id", submissionId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ score: parsed.score, feedback: parsed.feedback });
}