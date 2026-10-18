import Link from "next/link";
import { PanelsTopLeft } from "lucide-react";
import { LoginForm } from "@/components/forms";
import { getBrand } from "@/lib/data";
import { configured } from "@/lib/env";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
export const dynamic = "force-dynamic";
export const metadata = { title: "تسجيل الدخول" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!configured) redirect("/setup");
  const b = await getBrand();
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
          <p>مساحة عمل واحدة لإدارة الأصول والعقود والتحصيل.</p>
        </div>
        <small>Powered by Mesk LLC</small>
      </aside>
      <div className="auth-form-wrap">
        <div className="auth-form">
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
