"use server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { normalizeHost } from "@/lib/host";
import { isShowcaseHost } from "@/lib/showcase-host";
import { configured } from "@/lib/env";
import type { ActionState } from "./actions";
export async function requestQuote(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const h = normalizeHost((await headers()).get("host") || "");
  if (isShowcaseHost(h))
    return { ok: false, message: "هذا ديمو ميسك؛ لا تُرسل منه طلبات إلى أي شركة عميلة." };
  if (!configured)
    return { ok: false, message: "هذه معاينة فقط؛ الخدمة غير مربوطة بعد." };
  const s = (k: string) => String(form.get(k) || "").trim();
  if (s("website")) return { ok: true, message: "تم استلام طلبك." };
  if (
    s("full_name").length < 2 ||
    s("full_name").length > 150 ||
    s("phone").length < 8 ||
    s("phone").length > 25 ||
    s("message").length < 5 ||
    s("message").length > 2000
  )
    return { ok: false, message: "راجع الاسم ورقم الهاتف وتفاصيل الطلب." };
  const db = await createClient();
  const { error } = await db.rpc("submit_enquiry", {
    p_host: h,
    p_name: s("full_name"),
    p_phone: s("phone"),
    p_email: s("email") || null,
    p_message: s("message"),
    p_asset_code: s("asset_code") || null,
  });
  if (error)
    return {
      ok: false,
      message: error.message.includes("RATE_LIMIT")
        ? "وصلنا عدد كافٍ من طلباتك اليوم. سيتواصل الفريق معك."
        : "تعذر استلام الطلب حاليًا. تواصل مع الشركة هاتفيًا.",
    };
  return {
    ok: true,
    message:
      "تم تسجيل طلبك. سيتواصل معك فريق الشركة عبر بيانات الاتصال التي قدمتها.",
  };
}
