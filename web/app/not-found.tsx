import Link from "next/link";
export default function Page() {
  return (
    <main className="error-page">
      <h1>الصفحة غير موجودة</h1>
      <Link href="/" className="button primary">
        العودة للرئيسية
      </Link>
    </main>
  );
}
