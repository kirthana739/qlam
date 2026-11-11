import { NextResponse, type NextRequest } from "next/server";
import { PDFParse } from "pdf-parse";
import {
  generateJSON,
  ResumeDataSchema,
  PARSE_RESUME_SYSTEM_PROMPT,
  buildParseResumePrompt,
} from "@qlam/core";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  // 1. Verify authenticated session
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Validate incoming multipart form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "A valid PDF file is required" },
        { status: 400 }
      );
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit" },
        { status: 400 }
      );
    }

    // 3. Upload to private resumes bucket under <user_id>/
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 4. Extract text using pdf-parse v2 (PDFParse class)
    const parser = new PDFParse({ data: buffer });
    let extractedText = "";
    try {
      const textResult = await parser.getText();
      extractedText = textResult.text.trim();
    } finally {
      await parser.destroy();
    }

    if (!extractedText) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from PDF. Please make sure the resume contains readable text rather than only scanned images.",
        },
        { status: 400 }
      );
    }

    // 5. Parse resume with Gemini AI through core ai.ts
    const prompt = buildParseResumePrompt(extractedText);
    const parsedResume = await generateJSON({
      system: PARSE_RESUME_SYSTEM_PROMPT,
      prompt,
      schema: ResumeDataSchema,
    });

    // 6. Set previous default resumes to is_default = false
    await supabase
      .from("resumes")
      .update({ is_default: false })
      .eq("user_id", user.id);

    // 7. Save to resumes table using user session client
    const { data: resumeRow, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        file_path: filePath,
        parsed: parsedResume,
        is_default: true,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Database insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 8. Prefill profiles table using user session client
    const profileUpdates: {
      name?: string | null;
      phone?: string | null;
      city?: string | null;
      links?: unknown;
    } = {};

    if (parsedResume.basics.name) {
      profileUpdates.name = parsedResume.basics.name;
    }
    if (parsedResume.basics.phone) {
      profileUpdates.phone = parsedResume.basics.phone;
    }
    if (parsedResume.basics.location?.city) {
      profileUpdates.city = parsedResume.basics.location.city;
    }
    if (parsedResume.basics.links && parsedResume.basics.links.length > 0) {
      profileUpdates.links = parsedResume.basics.links;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      resume: resumeRow,
      parsed: parsedResume,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
