"use client";
import { useRouter } from "next/navigation";
export function DemoLogin() {
 const router=useRouter();
 return <form className="data-form" onSubmit={e=>{e.preventDefault();router.push('/demo/dashboard');}}>
  <div className="notice">تجربة تعليمية فقط؛ لا يتم التحقق من حساب أو إرسال البيانات إلى Supabase. بيانات الدخول المكتوبة افتراضية، والحفظ داخل الديمو معطّل.</div>
  <label>البريد الإلكتروني<input type="email" name="email" placeholder="demo@mesk.example" autoComplete="off" dir="ltr" required /></label>
  <label>كلمة المرور التجريبية<input type="password" name="password" autoComplete="off" dir="ltr" minLength={6} required /></label>
  <button className="button primary" type="submit">فتح مساحة العرض التجريبي</button>
 </form>;
}
