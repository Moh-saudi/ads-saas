"use client";
import { useActionState, useEffect, useRef } from "react";
import { requestQuote } from "@/app/enquiry-action";
export function EnquiryForm({ demo = false,assetCode="" }: { demo?: boolean;assetCode?:string }) {
  const [state, action, pending] = useActionState(requestQuote, {
    ok: false,
    message: "",
  });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} className="data-form public-enquiry" action={action}>
      <h3>اطلب عرضًا لحملتك</h3>
      <div className="form-grid">
        <label>
          الاسم
          <input name="full_name" required minLength={2} maxLength={150} />
        </label>
        <label>
          رقم الهاتف
          <input
            name="phone"
            type="tel"
            required
            minLength={8}
            maxLength={25}
            dir="ltr"
          />
        </label>
        <label>
          البريد الإلكتروني (اختياري)
          <input type="email" name="email" maxLength={200} />
        </label>
        <label>
          كود الموقع المطلوب (اختياري)
          <input name="asset_code" maxLength={80} defaultValue={assetCode} key={assetCode}/>
        </label>
      </div>
      <label>
        تفاصيل الحملة
        <textarea
          name="message"
          required
          minLength={5}
          maxLength={2000}
          rows={3}
        />
      </label>
      <label className="enquiry-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className="subtle">
        تُستخدم بياناتك للرد على هذا الطلب. لا يتضمن إرسال الطلب الاشتراك في
        رسائل واتساب.
      </p>
      {state.message && (
        <div
          role="status"
          className={`notice ${state.ok ? "success" : "danger"}`}
        >
          {state.message}
        </div>
      )}
      {demo && (
        <p className="notice">نموذج تجريبي؛ الإرسال معطل في المعاينة.</p>
      )}
      <button className="button primary" disabled={pending || demo}>
        {pending ? "جارٍ إرسال الطلب…" : "إرسال طلب عرض سعر"}
      </button>
    </form>
  );
}
