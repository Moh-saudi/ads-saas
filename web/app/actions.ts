"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/data";
import { configured } from "@/lib/env";
import { operationModules, operationMutation } from "@/lib/operation-actions";

export type ActionState = { ok: boolean; message: string };
export async function login(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!configured)
    return {
      ok: false,
      message: "أضف إعدادات Supabase أولاً من صفحة الإعداد.",
    };
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("email") || "").trim(),
    password: String(form.get("password") || ""),
  });
  if (error)
    return {
      ok: false,
      message: "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور وتفعيل الحساب.",
    };
  redirect("/app/dashboard");
}
export async function logout() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/login");
}

function friendly(message: string, code?: string) {
  const messages: Record<string, string> = {
    ASSET_HAS_ACTIVE_LEASES:
      "لا يمكن استبعاد الأصل قبل انتهاء أو إلغاء حجوزاته الحالية والمستقبلية.",
    ASSET_RETIRED: "هذا الأصل مستبعد. أعد تفعيله من بطاقة الأصل قبل حجزه.",
    ASSET_OUT_OF_SCOPE: "الأصل غير نشط أو يقع خارج نطاق صلاحيتك. راجع حالته وتغطية منطقتك.",
    CONTROL_ACCOUNT_REQUIRES_WORKFLOW:
      "هذا الحساب مرتبط بسجل تشغيلي؛ استخدم سند النقدية أو المخزون أو الفوترة المرتبطة به.",
    UPSTREAM_PARTY_REQUIRED:
      "اختر الجهة المالكة أو صاحب حق الاستغلال للعقد الصاعد.",
    INSUFFICIENT_STOCK: "الرصيد المتاح في المخزن لا يكفي لهذه الحركة.",
    INSUFFICIENT_CASH: "رصيد الخزينة أو البنك لا يكفي للصرف في هذا التاريخ.",
    INVALID_STOCK_RETURN:
      "المرتجع يجب أن يرتبط بصرف سابق ولا يتجاوز الكمية المصروفة.",
    PURCHASE_ALREADY_PROCESSED: "تم استلام أمر الشراء أو إلغاؤه بالفعل.",
    CASH_ACCOUNT_REQUIRED: "اختر الخزينة أو البنك الذي تمت عليه الحركة.",
    OPENING_BALANCE_ALREADY_USED:
      "الرصيد الافتتاحي متاح فقط قبل تسجيل أي حركة على الحساب.",
    INVALID_WORK_TRANSITION: "انتقال حالة أمر العمل غير مسموح.",
    INVALID_PAYROLL_TRANSITION: "راجع اعتماد الراتب وحالته قبل الصرف.",
    ATTENDANCE_ALREADY_OPEN:
      "يوجد حضور مفتوح لهذا الموظف. سجّل الانصراف أولًا.",
    NO_OPEN_ATTENDANCE: "لا يوجد تسجيل حضور مفتوح.",
    INVALID_ASSET_TAG: "الوسم لا يطابق الأصل المحدد.",
    FUTURE_ATTENDANCE: "لا يمكن تسجيل حضور أو انصراف في المستقبل.",
    REASON_REQUIRED: "أدخل سببًا واضحًا لتوثيق الإجراء.",
    UNBALANCED_JOURNAL: "القيد غير متوازن. لم تُحفظ الحركة.",
  };
  const known = Object.keys(messages).find((key) => message.includes(key));
  if (known) return messages[known];
  if (message.includes("CHAIN_CONFLICT"))
    return "CHAIN_CONFLICT — فترة الإيجار تتجاوز تغطية العقد الصاعد. قصّر المدة أو جدّد التغطية قبل الحفظ.";
  if (code === "23P01")
    return "العنصر محجوز خلال هذه الفترة. اختر فترة أو عنصرًا آخر.";
  if (code === "23505") return "الرقم أو الكود مستخدم بالفعل داخل الشركة.";
  if (code === "42501" || message.includes("FORBIDDEN"))
    return "لا تملك صلاحية إجراء هذا التغيير أو يقع العنصر خارج نطاقك.";
  if (message.includes("INVALID_PAYMENT"))
    return "الدفعة يجب أن تكون أكبر من صفر ولا تتجاوز الرصيد المتبقي.";
  if (message.includes("OVERRIDE_REQUIRES"))
    return "الاستثناء يحتاج مدير النظام وسببًا لا يقل عن 10 أحرف.";
  return `تعذر الحفظ: ${message}`;
}
export async function mutate(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const context = await requireContext();
  const { db, brand, profile } = context;
  const str = (key: string) => String(form.get(key) || "").trim();
  const num = (key: string) => Number(str(key));
  const kind = str("kind");
  const moduleFor: Record<string, string> = {
    ...operationModules,
    asset: "assets",
    party: "customers",
    contract: "customer_contracts",
    invoice: "finance",
    payment: "finance",
    license: "licenses",
    upstream: "upstream_contracts",
    governorate: "geography",
    district: "geography",
    street: "geography",
    asset_type: "assets",
  };
  if (moduleFor[kind]) {
    const { data } = await db
      .from("tenant_modules")
      .select("enabled")
      .eq("tenant_id", brand.id)
      .eq("module_key", moduleFor[kind])
      .maybeSingle();
    if (!data?.enabled)
      return { ok: false, message: "هذه الوحدة غير مفعّلة للشركة." };
  }
  let result: { error: { message: string; code?: string } | null };
  try {
    if (operationModules[kind]) {
      result = await operationMutation(kind, form, context);
      if (result.error)
        return {
          ok: false,
          message: friendly(result.error.message, result.error.code),
        };
      revalidatePath("/", "layout");
      return { ok: true, message: "تم تنفيذ العملية وتسجيلها بنجاح." };
    }
    switch (kind) {
      case "party":
        result = await db.from("parties").insert({
          tenant_id: brand.id,
          type: str("type"),
          name: str("name"),
          phone: str("phone"),
          tax_no: str("tax_no"),
          whatsapp: str("whatsapp") || null,
          wa_opt_in: form.get("wa_opt_in") === "on",
        });
        break;
      case "asset": {
        const lat = str("latitude"),
          lng = str("longitude");
        if (
          (lat && !lng) ||
          (!lat && lng) ||
          (lat &&
            (!Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90)) ||
          (lng &&
            (!Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180))
        )
          return {
            ok: false,
            message: "أدخل إحداثيات صحيحة: خط العرض وخط الطول معًا.",
          };
        result = await db.from("assets").insert({
          tenant_id: brand.id,
          code: str("code"),
          street_id: str("street_id"),
          type_id: str("type_id"),
          length_m: num("length_m") || null,
          width_m: num("width_m") || null,
          faces: num("faces") || 1,
          material: str("material"),
          geom: lat ? `SRID=4326;POINT(${Number(lng)} ${Number(lat)})` : null,
          public_visible: form.get("public_visible") === "on",
          cost: str("cost") ? num("cost") : null,
          install_date: str("install_date") || null,
          useful_life_months: str("useful_life_months")
            ? num("useful_life_months")
            : null,
        });
        break;
      }
      case "contract":
        result = await db.rpc("create_customer_contract", {
          p_customer_id: str("customer_id"),
          p_ref_no: str("ref_no"),
          p_start: str("start_date"),
          p_end: str("end_date"),
          p_lines: form.getAll("asset_id").map((id) => ({
            asset_id: String(id),
            monthly_price: num("monthly_price"),
          })),
          p_override_reason: str("override_reason") || null,
        });
        break;
      case "invoice":
        result = await db.rpc("create_itemized_invoice", {
          p_party: str("party_id"),
          p_direction: str("direction"),
          p_ref: str("ref_no"),
          p_issue: str("issue_date"),
          p_due: str("due_date"),
          p_contract: str("contract_id") || null,
          p_category: str("category_account_id") || null,
          p_lines: JSON.parse(str("invoice_lines") || "[]"),
        });
        break;
      case "payment":
        result = await db.rpc("record_invoice_payment", {
          p_invoice_id: str("invoice_id"),
          p_amount: num("amount"),
          p_paid_on: str("paid_on"),
          p_reference: str("reference"),
          p_cash_account_id: str("cash_account_id"),
        });
        break;
      case "license":
        result = await db.from("licenses").insert({
          tenant_id: brand.id,
          asset_id: str("asset_id"),
          ref_no: str("ref_no"),
          issuer: str("issuer"),
          expires_on: str("expires_on"),
        });
        break;
      case "governorate":
        result = await db
          .from("governorates")
          .insert({ tenant_id: brand.id, name: str("name") });
        break;
      case "district":
        result = await db.from("districts").insert({
          tenant_id: brand.id,
          name: str("name"),
          governorate_id: str("governorate_id"),
        });
        break;
      case "street":
        result = await db.from("streets").insert({
          tenant_id: brand.id,
          name: str("name"),
          district_id: str("district_id"),
          holding: str("holding"),
        });
        break;
      case "asset_type":
        result = await db.from("asset_types").insert({
          tenant_id: brand.id,
          name: str("name"),
          category: str("category"),
        });
        break;
      case "upstream":
        result = await db.rpc("create_upstream_agreement", {
          p_ref: str("ref_no"),
          p_start: str("start_date"),
          p_end: str("end_date"),
          p_model: str("billing_model"),
          p_grantor: str("grantor_party_id") || null,
          p_master: str("master_party_id") || null,
          p_annual_fee: num("annual_fee"),
          p_assets: form.getAll("asset_id").map((id) => ({
            asset_id: String(id),
            monthly_cost: num("monthly_cost"),
          })),
        });
        break;
      case "brand": {
        if (profile.role !== "admin")
          return { ok: false, message: "هذه الشاشة لمدير النظام." };
        let logo = str("logo_url");
        const file = form.get("logo_file");
        if (file instanceof File && file.size) {
          const mimeExt: Record<string, string> = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
          };
          if (!mimeExt[file.type] || file.size > 2 * 1024 * 1024)
            return {
              ok: false,
              message: "اختر شعار PNG أو JPG أو WebP بحجم أقصاه 2 ميجابايت.",
            };
          const bytes = new Uint8Array(await file.arrayBuffer());
          const valid =
            (file.type === "image/png" &&
              bytes[0] === 137 &&
              bytes[1] === 80) ||
            (file.type === "image/jpeg" &&
              bytes[0] === 255 &&
              bytes[1] === 216) ||
            (file.type === "image/webp" &&
              String.fromCharCode(...bytes.slice(8, 12)) === "WEBP");
          if (!valid)
            return {
              ok: false,
              message: "محتوى ملف الشعار غير مطابق لنوع الصورة.",
            };
          const path = `${brand.id}/${crypto.randomUUID()}.${mimeExt[file.type]}`;
          const { error } = await db.storage
            .from("tenant-logos")
            .upload(path, bytes, { contentType: file.type, upsert: false });
          if (error) return { ok: false, message: friendly(error.message) };
          logo = db.storage.from("tenant-logos").getPublicUrl(path)
            .data.publicUrl;
        }
        result = await db.rpc("update_brand", {
          p_name: str("name"),
          p_logo_url: logo,
          p_primary_color: str("primary_color"),
          p_phone: str("contact_phone"),
          p_email: str("contact_email"),
          p_whatsapp: str("whatsapp"),
          p_address: str("address"),
          p_title: str("website_title"),
          p_description: str("website_description"),
          p_public_enabled: form.get("public_site_enabled") === "on",
        });
        break;
      }
      case "modules": {
        if (profile.role !== "admin")
          return { ok: false, message: "هذه الشاشة لمدير النظام." };
        const allowed = [
          "dashboard",
          "customers",
          "geography",
          "assets",
          "upstream_contracts",
          "customer_contracts",
          "finance",
          "licenses",
          "whatsapp",
          ...[
            "employees",
            "attendance",
            "payroll",
            "inventory",
            "purchases",
            "maintenance",
            "inspections",
            "cashbook",
            "reports",
            "leads",
            "audit",
          ],
        ];
        result = await db.from("tenant_modules").upsert(
          allowed.map((module_key) => ({
            tenant_id: brand.id,
            module_key,
            enabled:
              module_key === "dashboard" || form.get(module_key) === "on",
          })),
          { onConflict: "tenant_id,module_key" },
        );
        break;
      }
      default:
        return { ok: false, message: "طلب غير معروف." };
    }
  } catch {
    return { ok: false, message: "تعذر الاتصال بالخدمة. أعد المحاولة." };
  }
  if (result.error)
    return {
      ok: false,
      message: friendly(result.error.message, result.error.code),
    };
  revalidatePath("/", "layout");
  return { ok: true, message: "تم الحفظ بنجاح." };
}
