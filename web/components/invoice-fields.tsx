"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { WorkspaceData } from "@/lib/types";
import { Field, Pick, egp } from "./ops-ui";
import { invoiceTotals } from "@/lib/invoice-calculations.mjs";
export function ItemizedInvoiceFields({ data: d }: { data: WorkspaceData }) {
  const [direction, setDirection] = useState("receivable"),
    [party, setParty] = useState(""),
    [lines, setLines] = useState([
      {
        description: "",
        quantity: "1",
        unit_price: "0",
        discount: "0",
        tax_rate: "0",
      },
    ]);
  const update = (i: number, key: string, value: string) =>
    setLines(lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
  const totals = invoiceTotals(lines);
  return (
    <>
      <Field name="ref_no" label="رقم الفاتورة" />
      <label>
        الاتجاه
        <select
          name="direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="receivable">فاتورة للمعلن (تحصيل)</option>
          <option value="payable">فاتورة طرف / مصروف مستحق (دفع)</option>
        </select>
      </label>
      <label>
        الطرف
        <select
          name="party_id"
          required
          value={party}
          onChange={(e) => setParty(e.target.value)}
        >
          <option value="">اختر…</option>
          {d.parties
            .filter((p) => direction === "payable" || p.type === "advertiser")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <div className="form-grid">
        <Field name="issue_date" label="تاريخ الإصدار" type="date" />
        <Field name="due_date" label="تاريخ الاستحقاق" type="date" />
      </div>
      {direction === "receivable" && (
        <Pick
          name="contract_id"
          label="العقد المرتبط"
          required={false}
          options={d.contracts
            .filter((c) => c.customer_id === party)
            .map((c) => ({ id: c.id, name: c.ref_no || c.id }))}
        />
      )}
      <Pick
        name="category_account_id"
        label={
          direction === "receivable"
            ? "حساب الإيراد (اختياري)"
            : "حساب التكلفة / الأصل (اختياري)"
        }
        required={false}
        options={d.operations.accounts
          .filter((a) =>
            direction === "receivable"
              ? a.kind === "revenue"
              : a.kind === "expense" ||
                (a.kind === "asset" &&
                  !["1100", "1400", "1500"].includes(a.code) &&
                  !d.operations.cashAccounts.some(
                    (c) => c.ledger_account_id === a.id,
                  )),
          )
          .map((a) => ({ id: a.id, name: a.code + " · " + a.name }))}
      />
      <div className="invoice-line-builder">
        <h3>بنود الفاتورة</h3>
        <input
          type="hidden"
          name="invoice_lines"
          value={JSON.stringify(lines)}
        />
        {lines.map((l, i) => (
          <div className="invoice-line-form" key={i}>
            <label className="invoice-description">
              وصف البند
              <input
                value={l.description}
                required
                maxLength={300}
                onChange={(e) => update(i, "description", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                الكمية
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={l.quantity}
                  onChange={(e) => update(i, "quantity", e.target.value)}
                />
              </label>
              <label>
                سعر الوحدة
                <input
                  required
                  type="number"
                  min="0"
                  step="0.0001"
                  value={l.unit_price}
                  onChange={(e) => update(i, "unit_price", e.target.value)}
                />
              </label>
              <label>
                خصم البند
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.discount}
                  onChange={(e) => update(i, "discount", e.target.value)}
                />
              </label>
              <label>
                الضريبة %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={l.tax_rate}
                  onChange={(e) => update(i, "tax_rate", e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="text-button"
              disabled={lines.length === 1}
              onClick={() => setLines(lines.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
              حذف البند
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setLines([
              ...lines,
              {
                description: "",
                quantity: "1",
                unit_price: "0",
                discount: "0",
                tax_rate: "0",
              },
            ])
          }
        >
          <Plus size={16} />
          إضافة بند
        </button>
        <div className="invoice-totals">
          <span>
            قبل الضريبة <b>{totals ? egp(totals.net) : "—"}</b>
          </span>
          <span>
            الضريبة <b>{totals ? egp(totals.tax) : "—"}</b>
          </span>
          <strong>الإجمالي {totals ? egp(totals.total) : "—"}</strong>
        </div>
        {!totals && <p role="alert" className="notice danger">راجع الكمية والسعر والخصم والضريبة؛ الخصم لا يتجاوز قيمة البند.</p>}
        <p className="subtle">
          نسبة الضريبة تُدخل حسب معاملة شركتك؛ لا يفترض النظام نسبة قانونية
          تلقائيًا.
        </p>
      </div>
    </>
  );
}
