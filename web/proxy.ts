import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configured, supabaseUrl, supabaseKey } from "@/lib/env";
import { normalizeHost } from "@/lib/host";
import { lookupBrand } from "@/lib/brand-lookup";

export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-tenant-id");
  headers.delete("x-tenant-name");
  const path = request.nextUrl.pathname;
  if (
    path === "/demo" ||
    path.startsWith("/demo/") ||
    path === "/demo-site" ||
    path.startsWith("/demo-site/") ||
    path.startsWith("/demo-invoice") ||
    !configured
  ) {
    return NextResponse.next({ request: { headers } });
  }
  // The Host header is mapped to an explicitly verified domain; forwarded tenant headers are never trusted.
  const host = normalizeHost(request.headers.get("host") || "");
  try {
    const { data, error } = await lookupBrand(host);
    if (error || !data?.[0]) {
      // If database is paused, offline, or unmapped domain, fall back to demo tenant
      headers.set("x-tenant-id", "demo");
      headers.set("x-tenant-name", "madar");
      return NextResponse.next({ request: { headers } });
    }
    headers.set("x-tenant-id", data[0].id);
    let response = NextResponse.next({ request: { headers } });
    const client = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers } });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    try {
      await client.auth.getUser();
    } catch {
      // Auth refresh error ignored if paused
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    headers.set("x-tenant-id", "demo");
    headers.set("x-tenant-name", "madar");
    return NextResponse.next({ request: { headers } });
  }
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icon.svg).*)",
  ],
};
