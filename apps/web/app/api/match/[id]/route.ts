import { NextResponse, type NextRequest } from "next/server";
import { UpdateMatchSchema, type MatchReasons } from "@qlam/core";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;

  // 1. Authenticate user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { status, skip_reason } = parsed.data;

  try {
    // 3. Fetch existing match
    const { data: existingMatch, error: fetchError } = await supabase
      .from("matches")
      .select("id, reasons, status")
      .eq("id", matchId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingMatch) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const currentReasons = (existingMatch.reasons || {}) as MatchReasons;
    const updatedReasons: MatchReasons = {
      ...currentReasons,
      ...(skip_reason ? { skip_reason } : {}),
    };

    // 4. Update match status and reasons
    const { data: updatedMatch, error: updateError } = await supabase
      .from("matches")
      .update({
        status,
        reasons: updatedReasons,
      })
      .eq("id", matchId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update match: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      match: updatedMatch,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update match";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
