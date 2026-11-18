import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { embed } from "@qlam/core";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SubmitAnswersSchema = z.object({
  applicationId: z.string().uuid({ message: "Invalid application ID" }),
  answers: z
    .array(
      z.object({
        question_key: z.string().min(1),
        question_text: z.string().min(1),
        answer: z.string().min(1),
      })
    )
    .min(1, "At least one answer must be submitted"),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = SubmitAnswersSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { applicationId, answers } = parsed.data;

    // 1. Verify application belongs to user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id, job_id, run_status")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: "Application not found or unauthorized" },
        { status: 404 }
      );
    }

    // 2. Save answers to bank with embeddings (if configured)
    for (const item of answers) {
      let embeddingStr: string | null = null;

      if (process.env.GEMINI_API_KEY && process.env.GEMINI_EMBED_MODEL) {
        try {
          const [vec] = await embed([item.question_text]);
          if (vec && vec.length > 0) {
            embeddingStr = JSON.stringify(vec);
          }
        } catch {
          // Non-blocking embedding generation
        }
      }

      await supabase.from("answers").upsert(
        {
          user_id: user.id,
          question_key: item.question_key,
          question_text: item.question_text,
          answer: item.answer,
          source: "user",
          embedding: embeddingStr,
        },
        { onConflict: "user_id,question_key" }
      );
    }

    // 3. Re-queue application
    const { data: updatedApp, error: updateError } = await supabase
      .from("applications")
      .update({
        run_status: "queued",
        needs_user_reason: null,
        error: null,
      })
      .eq("id", applicationId)
      .select()
      .single();

    if (updateError || !updatedApp) {
      return NextResponse.json(
        { error: `Failed to re-queue application: ${updateError?.message ?? "empty"}` },
        { status: 500 }
      );
    }

    // 4. Update match status
    await supabase
      .from("matches")
      .update({ status: "queued" })
      .eq("user_id", user.id)
      .eq("job_id", application.job_id);

    // 5. Log event
    await supabase.from("events").insert({
      user_id: user.id,
      type: "application_requeued",
      data: {
        application_id: applicationId,
        job_id: application.job_id,
        answers_count: answers.length,
      },
    });

    return NextResponse.json({
      success: true,
      application: updatedApp,
      message: "Answers saved to bank and application re-queued successfully.",
    });
  } catch (err) {
    console.error("[api/applications/answer] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred." },
      { status: 500 }
    );
  }
}
