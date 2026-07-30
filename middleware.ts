import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip Next internals (HMR, chunks, image opt, tooling) and static files.
     * Matching `_next/static` / `_next/image` alone still intercepts
     * `/_next/webpack-hmr` and breaks LAN / unauthenticated loads.
     */
    "/((?!_next/|__nextjs|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
