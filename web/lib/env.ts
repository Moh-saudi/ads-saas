import publicProject from "@/config/public-supabase.json";
// Publishable browser configuration is intentionally public. Environment variables override it.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || publicProject.url;
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  publicProject.publishableKey;
export const configured = Boolean(supabaseUrl && supabaseKey);
