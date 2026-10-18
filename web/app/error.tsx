"use client";
import Link from "next/link";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <h1>تعذر تحميل هذه الصفحة</h1>
      <p>
        راجع اتصال Supabase وتنفيذ migrations وإعدادات حسابك. لا تُعرض أرقام
        بديلة عند تعذر تحميل البيانات.
      </p>
      {process.env.NODE_ENV === "development" && <p>{error.message}</p>}
      <button className="button primary" onClick={reset}>
        إعادة المحاولة
      </button>
      <Link href="/setup">دليل الإعداد</Link>
    </main>
  );
}
