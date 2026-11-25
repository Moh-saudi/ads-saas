import Link from "next/link";
import { PanelsTopLeft, PlayCircle } from "lucide-react";
import { LoginForm } from "@/components/forms";
import { getBrand } from "@/lib/data";
import { demoBrand } from "@/lib/demo";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";
export const metadata = { title: "تسجيل الدخول" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const b = (await getBrand()) || demoBrand;
  const { error } = await searchParams;
  return (
    <main
      className="auth-page"
      style={{ "--brand": b?.primary_color || "#0b1f4d" } as CSSProperties}
    >
      <aside className="auth-aside">
        <Link href="/" className="public-logo" style={{ color: "white" }}>
          {b?.logo_url ? (
            <img src={b.logo_url} alt={b.name} />
          ) : (
            <PanelsTopLeft size={32} />
          )}{" "}
          {b?.name}
        </Link>
        <div>
          <h2>
            كل مواقعك.
            <br />
            رؤية أوضح.
            <br />
            قرارات أفضل.
          </h2>
          <p>مساحة عمل واحدة لإدارة اللوحات والعقود والتحصيل.</p>
        </div>
        <small>Powered by Mesk LLC</small>
      </aside>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <div
            style={{
              background: "#f0f7ff",
              border: "1px solid #c7d2fe",
              padding: "12px 14px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#1e3a8a",
              lineHeight: 1.5,
            }}
          >
            <strong>💡 استعراض المنصة بدون انتظار السيرفر:</strong>
            <p style={{ margin: "4px 0 10px 0" }}>
              إذا كان سيرفر قاعدة البيانات متوقفاً مؤقتاً أو ترغب في التجربة فوراً، يمكنك معاينة لوحة التحكم مباشرة ببيانات تجريبية كاملة.
            </p>
            <Link
              href="/demo"
              className="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#2563eb",
                color: "#ffffff",
                padding: "6px 14px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              <PlayCircle size={16} /> دخول وضع المعاينة (Demo)
            </Link>
          </div>

          <span className="public-eyebrow">مرحبًا بعودتك</span>
          <h1>تسجيل الدخول</h1>
          <p>أدخل بيانات حسابك للوصول إلى مساحة عمل شركتك.</p>
          {error === "tenant" && (
            <p className="notice danger">
              حسابك غير مرتبط بهذه الشركة. استخدم نطاق شركتك أو اطلب من المدير
              ربط حسابك.
            </p>
          )}
          <LoginForm />
          <div className="auth-links">
            الحسابات تُنشأ عن طريق مدير الشركة.{" "}
            <Link href="/">العودة للموقع</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
