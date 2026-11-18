import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ApplyRequestSchema = z.object({
  jobId: z.string().uuid({ message: "Invalid job ID" }),
  matchId: z.string().uuid().optional(),
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
    const rawBody = await request.json();
    const parsed = ApplyRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { jobId, matchId } = parsed.data;

    // 1. Check existing application row
    const { data: existing } = await supabase
      .from("applications")
      .select("id, run_status, dry_run, submitted_at, error, needs_user_reason")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .maybeSingle();

    if (existing && (existing.run_status === "running" || existing.run_status === "submitted")) {
      return NextResponse.json({
        application: existing,
        status: existing.run_status,
        message: `Application is already ${existing.run_status}.`,
      });
    }

    // 2. Upsert application record with run_status = 'queued'
    const { data: appRow, error: upsertError } = await supabase
      .from("applications")
      .upsert(
        {
          user_id: user.id,
          job_id: jobId,
          run_status: "queued",
          mode: "manual",
          stage: "applied",
          error: null,
          needs_user_reason: null,
          dry_run: false,
        },
        { onConflict: "user_id,job_id" }
      )
      .select()
      .single();

    if (upsertError || !appRow) {
      return NextResponse.json(
        { error: `Failed to create application: ${upsertError?.message ?? "empty"}` },
        { status: 500 }
      );
    }

    // 3. Update match status to 'queued'
    if (matchId) {
      await supabase
        .from("matches")
        .update({ status: "queued" })
        .eq("id", matchId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("matches")
        .update({ status: "queued" })
        .eq("user_id", user.id)
        .eq("job_id", jobId);
    }

    // 4. Log application_queued event
    await supabase.from("events").insert({
      user_id: user.id,
      type: "application_queued",
      data: {
        application_id: appRow.id,
        job_id: jobId,
        match_id: matchId || null,
      },
    });

    return NextResponse.json({
      application: appRow,
      status: "queued",
    });
  } catch (err) {
    console.error("[api/apply] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error occurred." },
      { status: 500 }
    );
  }
}
