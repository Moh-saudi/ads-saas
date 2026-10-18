import Link from "next/link";
import { PanelsTopLeft, ArrowUpLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getBrand } from "@/lib/data";
import { configured } from "@/lib/env";
export const metadata = { title: "إعداد المنصة" };
export default async function Page() {
  if(configured && await getBrand())redirect("/");
  return (
    <main className="setup-page card">
      <PanelsTopLeft size={42} color="#d4a017" />
      <p className="eyebrow">MESK · SMART SIGNAGE</p>
      <h1>منصتك جاهزة للربط.</h1>
      <p>
        موقع مستقل بهوية كل عميل، ولوحة لإدارة المواقع والعقود والتحصيل، على
        Next.js وSupabase.
      </p>
      <ol>
        <li>
          نفّذ migrations بالترتيب داخل Supabase SQL Editor، ثم{" "}
          <code>supabase/seed.sql</code> للبيئة التجريبية فقط.
        </li>
        <li>
          انسخ <code>web/.env.example</code> إلى <code>web/.env.local</code> وضع
          الرابط والمفتاح العام.
        </li>
        <li>
          أنشئ مستخدمًا في Supabase Auth واربطه بشركته في <code>profiles</code>.
        </li>
        <li>
          في Vercel اختر <code>Root Directory = web</code> وأضف متغيرات البيئة.
          سجّل نطاق النشر في <code>tenant_domains</code> بعد التحقق منه.
        </li>
      </ol>
      <Link href="/demo/dashboard" className="button primary">
        استكشف لوحة الإدارة <ArrowUpLeft size={17} />
      </Link>
      <Link href="/demo-site" className="button secondary">
        شاهد موقع العميل
      </Link>
    </main>
  );
}
