import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabaseKey } from "@/lib/env";

export async function createClient() {
  const jar = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server components cannot write; proxy refreshes the cookies. */
        }
      },
    },
  });
}
