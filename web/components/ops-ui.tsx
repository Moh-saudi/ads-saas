"use client";
import { type ReactNode } from "react";
import { Layers, Plus } from "lucide-react";
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
export { FormDialog as Dialog } from "./form-dialog";
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
