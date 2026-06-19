import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// @cloudflare/next-on-pages cannot set up pattern-level RSC routing for
// ISR-style blog post pages (Node.js runtime), so ?_rsc= requests 404.
// The worker DOES have a filesystem rule: /path/.rsc → /path.rsc, and
// all individual blog post .rsc fallback files are in the prerendered map.
// This middleware rewrites ?_rsc= requests to the /.rsc path format so
// the worker's existing routing can serve the pre-built RSC payload.
export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  if (url.searchParams.has("_rsc")) {
    const stripped = url.pathname.endsWith("/")
      ? url.pathname.slice(0, -1)
      : url.pathname;
    const rscUrl = url.clone();
    rscUrl.pathname = `${stripped}/.rsc`;
    rscUrl.search = "";
    return NextResponse.rewrite(rscUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/blog/:slug+",
};
