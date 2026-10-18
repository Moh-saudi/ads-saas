import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./env";

// Only this public, read-only lookup is retried. Never retry business mutations here.
export async function lookupBrand(host: string) {
  const db = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let result = await db.rpc("tenant_by_host", { h: host });
  if (result.error && (result.status === 0 || result.status === 408 || result.status === 429 || result.status >= 500)) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    result = await db.rpc("tenant_by_host", { h: host });
  }
  return result;
}
