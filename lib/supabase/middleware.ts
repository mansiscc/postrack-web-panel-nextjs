import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  fetchUserProfile,
  isUserAccountActive,
} from "@/lib/auth/fetch-profile";
import {
  canAccessPath,
  getModuleForPath,
  isPublicPath,
} from "@/lib/auth/routes";
import { getDefaultHomePath } from "@/lib/auth/session";
import type { Database } from "@/types/database.types";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Defense in depth: never auth-gate Next.js internals (HMR, tooling).
  if (pathname.startsWith("/_next/") || pathname.startsWith("/__nextjs")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPath(pathname);

  if (!user) {
    if (isPublic) return supabaseResponse;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  const profile = await fetchUserProfile(supabase, user.id);

  if (!profile) {
    await supabase.auth.signOut();
    if (pathname === "/login") return supabaseResponse;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (!isUserAccountActive(profile)) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (!profile.companyIsActive) {
    if (pathname === "/inactive") return supabaseResponse;
    const inactiveUrl = request.nextUrl.clone();
    inactiveUrl.pathname = "/inactive";
    return NextResponse.redirect(inactiveUrl);
  }

  if (isPublic) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = getDefaultHomePath(profile);
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (pathname === "/" && profile.role !== "Admin") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = getDefaultHomePath(profile);
    return NextResponse.redirect(homeUrl);
  }

  const routeModule = getModuleForPath(pathname);
  if (routeModule && !canAccessPath(pathname, profile)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = getDefaultHomePath(profile);
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}
