"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { mutate, login, type ActionState } from "@/app/actions";
import { LoaderCircle } from "lucide-react";
const initial: ActionState = { ok: false, message: "" };
export function DataForm({
  kind,
  children,
  demo = false,
  disabled = false,
  label = "حفظ البيانات",
}: {
  kind: string;
  children: ReactNode;
  demo?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const [state, action, pending] = useActionState(mutate, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !["brand", "modules", "asset_update", "website_config"].includes(kind))
      ref.current?.reset();
  }, [state, kind]);
  return (
    <form ref={ref} action={action} className="data-form">
      <input type="hidden" name="kind" value={kind} />
      {children}
      {demo && (
        <div className="notice">
          نسخة تجريبية للعرض؛ الحفظ متاح بعد ربط Supabase.
        </div>
      )}
      {state.message && (
        <div
          role="status"
          className={`notice ${state.ok ? "success" : "danger"}`}
        >
          {state.message}
        </div>
      )}
      <button
        className="button primary"
        type="submit"
        disabled={pending || demo || disabled}
      >
        {pending ? <LoaderCircle size={18} className="spin" /> : null}
        {pending ? "جارٍ الحفظ…" : label}
      </button>
    </form>
  );
}
export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);
  return (
    <form action={action} className="data-form">
      <label>
        البريد الإلكتروني
        <input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="name@company.com"
          dir="ltr"
          required
        />
      </label>
      <label>
        كلمة المرور
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          minLength={6}
          required
          dir="ltr"
        />
      </label>
      {state.message && (
        <p role="alert" className="notice danger">
          {state.message}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}
