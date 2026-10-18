"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Layers, Plus } from "lucide-react";
export const fmt = (n: unknown) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    Number(n || 0),
  );
export const egp = (n: unknown) => `${fmt(n)} ج.م`;
export const date = (v: string | null | undefined) =>
  v
    ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Cairo",
      }).format(new Date(v.length === 10 ? v + "T12:00:00Z" : v))
    : "—";
export const time = (v: string | null | undefined) =>
  v
    ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Cairo",
      }).format(new Date(v))
    : "—";
export function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function GridTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">
          <Layers size={28} />
          <p>لا توجد سجلات مطابقة. أضف أول سجل للبدء.</p>
        </div>
      )}
    </div>
  );
}
const labels: Record<string, string> = {
  active: "نشط",
  suspended: "موقوف",
  terminated: "منتهية خدمته",
  pending: "قيد الانتظار",
  approved: "معتمد",
  rejected: "مرفوض",
  draft: "مسودة",
  paid: "مدفوع",
  ordered: "بانتظار التوريد",
  received: "مستلم",
  cancelled: "ملغى",
  open: "مفتوح",
  assigned: "تم تعيين المسؤول",
  in_progress: "جارٍ التنفيذ",
  completed: "مكتمل",
  good: "جيدة",
  needs_maintenance: "تحتاج صيانة",
  damaged: "تالفة",
  missing: "مفقودة",
  sent: "تم الإرسال إلى مزوّد واتساب",
  failed: "فشل",
  uncertain: "نتيجة غير مؤكدة",
  processing: "جارٍ الإرسال",
  new: "جديد",
  contacted: "تم التواصل",
  qualified: "عميل مهتم",
  closed: "مغلق",
  high: "عالية",
  urgent: "عاجلة",
  normal: "عادية",
  low: "منخفضة",
};
export function State({ value }: { value: string }) {
  return (
    <span
      className={`badge ${["active", "approved", "completed", "good", "received", "sent", "paid"].includes(value) ? "vacant" : ["failed", "damaged", "missing", "cancelled", "rejected", "urgent", "uncertain"].includes(value) ? "maintenance" : "expiring"}`}
    >
      {labels[value] || value}
    </span>
  );
}
export function Add({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="button primary" onClick={onClick}>
      <Plus size={16} />
      {children}
    </button>
  );
}
export function Mini({
  label,
  value,
  help,
}: {
  label: string;
  value: ReactNode;
  help?: string;
}) {
  return (
    <div className="card ops-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {help && <small>{help}</small>}
    </div>
  );
}
export function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
  min,
  step = "any",
  maxLength,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  min?: string;
  step?: string;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        lang={["number", "date", "datetime-local", "time"].includes(type) ? "en" : undefined}
        dir={["number", "date", "datetime-local", "time", "tel", "email"].includes(type) ? "ltr" : undefined}
        defaultValue={value}
        required={required}
        min={min}
        step={type === "number" ? step : undefined}
        maxLength={maxLength}
      />
    </label>
  );
}
export function Pick({
  name,
  label,
  options,
  required = true,
  value,
}: {
  name: string;
  label: string;
  options: { id: string; name: string }[];
  required?: boolean;
  value?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} required={required} defaultValue={value || ""}>
        <option value="">{required ? "اختر…" : "بدون ربط"}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Note({
  name = "notes",
  label = "ملاحظات / سبب الإجراء",
  required = false,
  value,
}: {
  name?: string;
  label?: string;
  required?: boolean;
  value?: string;
}) {
  return (
    <label>
      {label}
      <textarea
        name={name}
        required={required}
        minLength={required ? 5 : undefined}
        maxLength={2000}
        rows={3}
        defaultValue={value}
      />
    </label>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ) || [],
        );
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal ops-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق">
            <X size={21} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function exportCsv(
  filename: string,
  headings: string[],
  rows: unknown[][],
) {
  const csv =
    "\ufeff" +
    [headings, ...rows]
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v ?? "")
                .replace(/^[\s]*[=+@\-]/, "'")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
