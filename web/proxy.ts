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
  // These routes render fixtures only and must not depend on the hosted tenant lookup.
  if (path === "/demo" || path.startsWith("/demo/") || path === "/demo-site" || path.startsWith("/demo-invoice/") || !configured) {
    return NextResponse.next({ request: { headers } });
  }
  // The Host header is mapped to an explicitly verified domain; forwarded tenant headers are never trusted.
  const host = normalizeHost(request.headers.get("host") || "");
  const { data, error } = await lookupBrand(host);
  if (error)
    return new NextResponse(
      "تعذر الاتصال بقاعدة البيانات. راجع الإعدادات ثم أعد المحاولة.",
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  if (!data?.[0])
    return new NextResponse(
      "هذا النطاق غير مرتبط بشركة معتمدة. أضفه في tenant_domains بعد التحقق من ملكيته.",
      { status: 404 },
    );
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
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icon.svg).*)",
  ],
};
