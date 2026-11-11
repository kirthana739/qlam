import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect every /app route
  if (pathname.startsWith("/app")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Check onboarding status
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_done")
      .eq("user_id", user.id)
      .maybeSingle();

    const isOnboardingDone = profile?.onboarding_done === true;

    if (!isOnboardingDone && pathname !== "/app/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/app/onboarding";
      return NextResponse.redirect(url);
    }

    if (isOnboardingDone && pathname === "/app/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/app/jobs";
      return NextResponse.redirect(url);
    }

    if (pathname === "/app") {
      const url = request.nextUrl.clone();
      url.pathname = isOnboardingDone ? "/app/jobs" : "/app/onboarding";
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated user away from /login
  if (pathname === "/login" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_done")
      .eq("user_id", user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = profile?.onboarding_done ? "/app/jobs" : "/app/onboarding";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
