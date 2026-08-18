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
    .select(
      "id, content, learner_id, assignment_id, classroom_assignments(title, instructions)"
    )
    .eq("id", submissionId)
    .single();

  if (fetchErr || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.learner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const assignment: any = submission.classroom_assignments;

  const prompt = `You are grading a student homework submission. Respond ONLY with raw JSON, no markdown fences, in the form {"score": number (0-100), "feedback": string (2-4 sentences, constructive, specific)}.

Assignment: ${assignment?.title ?? "Untitled"}
Instructions: ${assignment?.instructions ?? "None provided"}

Student submission:
${submission.content}`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return NextResponse.json(
      { error: `AI grading failed: ${errText}` },
      { status: 502 }
    );
  }

  const geminiData = await geminiRes.json();
  const rawText: string =
    geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  let parsed: { score: number; feedback: string };
  try {
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "Could not parse AI response" },
      { status: 502 }
    );
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