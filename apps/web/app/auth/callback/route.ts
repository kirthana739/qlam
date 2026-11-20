import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Behind a proxy (Render), request.url points at the internal address
 * (https://localhost:10000). Use the forwarded host so redirects go to the
 * public site instead. In local development, keep using the request origin.
 */
function getBaseUrl(request: Request, requestOrigin: string): string {
  if (process.env.NODE_ENV === "development") {
    return requestOrigin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    return `https://${forwardedHost}`;
  }

  return requestOrigin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const baseUrl = getBaseUrl(request, requestUrl.origin);

  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/app/jobs";
  const error =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, baseUrl)
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Only allow internal paths (protects against open redirects).
      // "//example.com" starts with "/" but points to another site, so block it.
      const safeNext =
        next.startsWith("/") && !next.startsWith("//") ? next : "/app/jobs";
      return NextResponse.redirect(new URL(safeNext, baseUrl));
    }

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(exchangeError.message)}`,
        baseUrl
      )
    );
  }

  // If no code and no error, redirect to login
  return NextResponse.redirect(new URL("/login", baseUrl));
}