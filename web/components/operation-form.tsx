"use client";
import { PaymentMethodField } from "./payment-method-field";
import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Download,
  Printer,
  Radio,
  LocateFixed,
} from "lucide-react";
import type { WorkspaceData } from "@/lib/types";
import type { OperationModal } from "./operations";
import { DataForm } from "./forms";
import { Field, Pick, Note, GridTable, egp, fmt, date, State } from "./ops-ui";
export function OperationForm({
  modal: m,
  data: d,
}: {
  modal: OperationModal;
  data: WorkspaceData;
}) {
  const o = d.operations,
    employee = o.employees.find((e) => e.id === m.id),
    work = o.workOrders.find((w) => w.id === m.id),
    payroll = o.payroll.find((p) => p.id === m.id),
    purchase = o.purchases.find((p) => p.id === m.id),
    leave = o.leaves.find((l) => l.id === m.id),
    lead = o.enquiries.find((l) => l.id === m.id);
  const [stockKind, setStockKind] = useState("receipt"),
    [cashKind, setCashKind] = useState("expense"),
    [chosenEmployee, setChosenEmployee] = useState(employee?.id || ""),
    [salary, setSalary] = useState("0");
  const people = o.employeeDirectory
      .filter((e) => e.status === "active")
      .map((e) => ({ id: e.id, name: `${e.code} · ${e.full_name}` })),
    assets = d.assets.map((a) => ({
      id: a.id,
      name: `${a.code} · ${a.street_name}`,
    })),
    warehouses = o.warehouses.map((w) => ({ id: w.id, name: w.name })),
    items = o.items.map((i) => ({ id: i.id, name: `${i.sku} · ${i.name}` })),
    cashAccounts = o.cashAccounts.map((c) => ({
      id: c.id,
      name: `${c.name} · ${egp(c.balance)}`,
    }));
  const kind = m.kind;
  if (kind === "qr_preview") return <QrPreview data={d} id={m.id || ""} />;
  if (kind === "journal_detail") {
    const j = o.journals.find((j) => j.id === m.id);
    const lines = o.journalLines.filter((l) => l.entry_id === m.id);
    return (
      <>
        <h3>{j?.description}</h3>
        <p className="subtle">
          {j?.ref_no} · {date(j?.entry_date)}
        </p>
        <GridTable
          columns={["الحساب", "مدين", "دائن"]}
          rows={lines.map((l) => [
            o.accounts.find((a) => a.id === l.account_id)?.name || "—",
            egp(l.debit),
            egp(l.credit),
          ])}
        />
        <div className="notice">
          مدين {egp(lines.reduce((s, l) => s + Number(l.debit), 0))} · دائن{" "}
          {egp(lines.reduce((s, l) => s + Number(l.credit), 0))}
        </div>
      </>
    );
  }
  if (kind === "audit_detail") {
    const event = o.audit.find((a) => a.id === m.id);
    return (
      <>
        <p>
          {event?.table_name} · {event?.operation} · {date(event?.created_at)}
        </p>
        <pre className="audit-json" dir="ltr">
          {JSON.stringify(event?.changes, null, 2)}
        </pre>
      </>
    );
  }
  if (kind === "purchase_detail")
    return (
      <>
        <h3>{purchase?.ref_no}</h3>
        <p>
          {d.parties.find((p) => p.id === purchase?.supplier_id)?.name} ·{" "}
          {date(purchase?.ordered_on)}
        </p>
        <GridTable
          columns={["الصنف", "الكمية", "سعر الوحدة", "الإجمالي"]}
          rows={o.purchaseLines
            .filter((l) => l.purchase_id === m.id)
            .map((l) => [
              o.items.find((i) => i.id === l.item_id)?.name,
              fmt(l.quantity),
              egp(l.unit_cost),
              egp(Number(l.quantity) * Number(l.unit_cost)),
            ])}
        />
        <p className="subtle">{purchase?.notes}</p>
      </>
    );
  return (
    <DataForm
      kind={kind}
      demo={d.demo}
      label={
        kind === "purchase_receive"
          ? "تأكيد الاستلام وإضافة المخزون"
          : kind === "payroll_settle"
            ? payroll?.status === "draft"
              ? "اعتماد الاستحقاق"
              : "صرف الراتب من الخزينة"
            : "حفظ وتنفيذ"
      }
    >
      {m.id && <input type="hidden" name="id" value={m.id} />}
      {kind === "employee" && (
        <>
          <div className="form-grid">
            <Field name="code" label="الكود الوظيفي" value={employee?.code} />
            <Field
              name="full_name"
              label="الاسم الكامل"
              value={employee?.full_name}
            />
            <Field
              name="department"
              label="القسم"
              value={employee?.department}
            />
            <Field
              name="job_title"
              label="المسمى الوظيفي"
              value={employee?.job_title}
            />
            <Field
              name="phone"
              label="الهاتف"
              value={employee?.phone || ""}
              required={false}
            />
            <Field
              name="email"
              label="البريد الإلكتروني"
              type="email"
              value={employee?.email || ""}
              required={false}
            />
            <Field
              name="hire_date"
              label="تاريخ الالتحاق"
              type="date"
              value={employee?.hire_date}
            />
            <Field
              name="base_salary"
              label="الراتب الأساسي"
              type="number"
              min="0"
              value={employee?.base_salary || 0}
            />
          </div>
          <Pick
            name="district_id"
            label="نطاق المنطقة"
            options={d.districts}
            required={false}
            value={employee?.district_id || ""}
          />
          <Pick
            name="profile_id"
            label="حساب الدخول المرتبط (اختياري)"
            options={o.tenantUsers.map((u) => ({
              id: u.id,
              name: u.full_name || u.role,
            }))}
            value={employee?.profile_id || ""}
            required={false}
          />
          <Pick
            name="status"
            label="حالة الموظف"
            value={employee?.status || "active"}
            options={[
              { id: "active", name: "نشط" },
              { id: "suspended", name: "موقوف" },
              { id: "terminated", name: "منتهية خدمته" },
            ]}
          />
          <p className="subtle">
            ربط حساب الدخول يُستخدم لإثبات الحضور الذاتي. لا يغيّر دور المستخدم
            أو صلاحياته.
          </p>
        </>
      )}
      {kind === "attendance_clock" && (
        <>
          <Pick
            name="employee_id"
            label="الموظف"
            options={o.employees
              .filter((e) => e.status === "active")
              .map((e) => ({ id: e.id, name: e.full_name }))}
          />
          <Pick
            name="clock_action"
            label="الإجراء"
            options={[
              { id: "in", name: "تسجيل حضور الآن" },
              { id: "out", name: "تسجيل انصراف الآن" },
            ]}
          />
          <div className="notice">
            يستخدم النظام توقيت الخادم. تسجيل موظف آخر يتطلب مديرًا أو مسؤول
            موارد بشرية.
          </div>
        </>
      )}
      {kind === "attendance_manual" && (
        <>
          <Pick name="employee_id" label="الموظف" options={people} />
          <Field name="work_date" label="يوم العمل" type="date" />
          <div className="form-grid">
            <Field
              name="check_in"
              label="وقت الحضور بتوقيت القاهرة"
              type="time"
            />
            <Field
              name="check_out"
              label="وقت الانصراف بتوقيت القاهرة"
              type="time"
            />
          </div>
          <Note label="سبب الإدخال أو تصحيح السجل" required />
          <p className="subtle">
            إذا سبق وقت الانصراف وقت الحضور، يُعتبر الانصراف في اليوم التالي
            لوردية ليلية.
          </p>
        </>
      )}
      {kind === "leave" && (
        <>
          <Pick
            name="employee_id"
            label="الموظف"
            options={o.employees.map((e) => ({ id: e.id, name: e.full_name }))}
          />
          <div className="form-grid">
            <Field name="start_date" label="من" type="date" />
            <Field name="end_date" label="إلى" type="date" />
          </div>
          <Pick
            name="leave_kind"
            label="نوع الإجازة"
            options={[
              { id: "annual", name: "سنوية" },
              { id: "sick", name: "مرضية" },
              { id: "unpaid", name: "دون راتب" },
              { id: "other", name: "أخرى" },
            ]}
          />
          <Note name="reason" label="سبب الطلب" required />
        </>
      )}
      {kind === "leave_decision" && (
        <>
          <div className="notice">
            {
              o.employeeDirectory.find((e) => e.id === leave?.employee_id)
                ?.full_name
            }{" "}
            · {date(leave?.start_date)} إلى {date(leave?.end_date)}
            <br />
            {leave?.reason}
          </div>
          <Pick
            name="decision"
            label="القرار"
            options={[
              { id: "approve", name: "اعتماد الإجازة" },
              { id: "reject", name: "رفض الطلب" },
            ]}
          />
          <Note label="تعليق المراجعة" required />
        </>
      )}
      {kind === "payroll" && (
        <>
          <label>
            الموظف
            <select
              name="employee_id"
              required
              value={chosenEmployee}
              onChange={(e) => {
                setChosenEmployee(e.target.value);
                setSalary(
                  String(
                    o.employees.find((x) => x.id === e.target.value)
                      ?.base_salary || 0,
                  ),
                );
              }}
            >
              <option value="">اختر…</option>
              {people.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <Field name="period" label="شهر الراتب" type="month" />
          <label>
            الأساس المعتمد
            <input lang="en" dir="ltr"
              name="base_amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </label>
          <div className="form-grid">
            <Field
              name="bonus"
              label="المكافآت"
              type="number"
              min="0"
              value="0"
            />
            <Field
              name="deductions"
              label="الخصومات المعتمدة"
              type="number"
              min="0"
              value="0"
            />
          </div>
          <Note />
          <div className="notice">
            يُحفظ أولًا كمسودة. لا يُرحّل أو يصرف قبل الاعتماد. تأكد من تطبيق
            لائحة شركتك قبل اعتماد الخصومات.
          </div>
        </>
      )}
      {kind === "payroll_settle" && (
        <>
          <div className="notice">
            {
              o.employeeDirectory.find((e) => e.id === payroll?.employee_id)
                ?.full_name
            }{" "}
            · {date(payroll?.period)}
            <br />
            الصافي: {egp(payroll?.net_amount)}
          </div>
          <input
            type="hidden"
            name="payroll_action"
            value={payroll?.status === "draft" ? "approve" : "pay"}
          />
          {payroll?.status === "approved" && (
            <>
              <Pick
                name="cash_account_id"
                label="الصرف من"
                options={cashAccounts}
              />
              <Field name="paid_on" label="تاريخ الصرف" type="date" />
            </>
          )}
        </>
      )}
      {kind === "warehouse" && (
        <>
          <Field name="code" label="كود المخزن" />
          <Field name="name" label="اسم المخزن" />
          <Pick name="district_id" label="المنطقة" options={d.districts} />
          <Field name="address" label="العنوان" required={false} />
        </>
      )}
      {kind === "item" && (
        <>
          <Field name="sku" label="كود الصنف SKU" />
          <Field name="name" label="اسم الصنف" />
          <Field name="unit" label="وحدة القياس" value="قطعة" />
          <Field
            name="reorder_level"
            label="حد إعادة الطلب"
            type="number"
            min="0"
            value="0"
          />
        </>
      )}
      {kind === "stock" && (
        <>
          <label>
            نوع الحركة
            <select
              name="movement_kind"
              value={stockKind}
              onChange={(e) => setStockKind(e.target.value)}
            >
              <option value="receipt">إضافة مخزون يدوي / رصيد افتتاحي</option>
              <option value="issue">صرف</option>
              <option value="transfer">تحويل بين المخازن</option>
              <option value="return">مرتجع من صرف سابق</option>
              <option value="adjustment_in">زيادة جرد</option>
              <option value="adjustment_out">عجز جرد</option>
            </select>
          </label>
          <Field name="ref_no" label="رقم الحركة" />
          <Pick name="item_id" label="الصنف" options={items} />
          {["issue", "transfer", "adjustment_out"].includes(stockKind) && (
            <Pick
              name="from_warehouse_id"
              label="من مخزن"
              options={warehouses}
            />
          )}{" "}
          {["receipt", "transfer", "return", "adjustment_in"].includes(
            stockKind,
          ) && (
            <Pick
              name="to_warehouse_id"
              label="إلى مخزن"
              options={warehouses}
            />
          )}
          <Field name="quantity" label="الكمية" type="number" min="0.001" />
          {["receipt", "adjustment_in"].includes(stockKind) ? (
            <Field
              name="unit_cost"
              label="تكلفة الوحدة"
              type="number"
              min="0"
            />
          ) : (
            <input type="hidden" name="unit_cost" value="0" />
          )}
          {stockKind === "return" && (
            <Pick
              name="return_of"
              label="إذن الصرف الأصلي"
              options={o.stockMoves
                .filter((m) => m.kind === "issue")
                .map((m) => ({
                  id: m.id,
                  name: `${m.ref_no} · ${fmt(m.quantity)}`,
                }))}
            />
          )}
          <Pick
            name="asset_id"
            label="اللوحة المرتبطة"
            options={assets}
            required={false}
          />
          <Pick
            name="work_order_id"
            label="أمر العمل المرتبط"
            options={o.workOrders
              .filter((w) => !["completed", "cancelled"].includes(w.status))
              .map((w) => ({ id: w.id, name: w.ref_no + " · " + w.title }))}
            required={false}
          />
          <Note required />
          <div className="notice">
            الصرف والتحويل يقيّمان بالمتوسط المرجح. استلام مشتريات المورد يتم من
            شاشة المشتريات. الإضافة اليدوية تُرحّل مقابل حقوق الملكية، والجرد
            مقابل حساب فرق الجرد.
          </div>
        </>
      )}
      {kind === "purchase" && (
        <>
          <Field name="ref_no" label="رقم أمر الشراء" />
          <Pick
            name="supplier_id"
            label="المورد"
            options={d.parties.filter((p) => p.type === "supplier")}
          />
          <Pick
            name="warehouse_id"
            label="مخزن الاستلام"
            options={warehouses}
          />
          <div className="form-grid">
            <Field name="ordered_on" label="تاريخ الطلب" type="date" />
            <Field
              name="expected_on"
              label="التوريد المتوقع"
              type="date"
              required={false}
            />
          </div>
          <PurchaseLines items={items} />
          <Note />
        </>
      )}
      {kind === "purchase_receive" && (
        <>
          <h3>استلام {purchase?.ref_no}</h3>
          <div className="notice">
            سيتم استلام جميع بنود الأمر إلى مخزن{" "}
            {o.warehouses.find((w) => w.id === purchase?.warehouse_id)?.name}،
            وتحديث الكميات والتكلفة وتسجيل قيد الاستلام في معاملة واحدة. لا يمكن
            تكرار الاستلام.
          </div>
          <GridTable
            columns={["الصنف", "الكمية"]}
            rows={o.purchaseLines
              .filter((l) => l.purchase_id === m.id)
              .map((l) => [
                o.items.find((i) => i.id === l.item_id)?.name,
                fmt(l.quantity),
              ])}
          />
        </>
      )}
      {kind === "purchase_invoice" && (
        <>
          <div className="notice">
            تُنشأ فاتورة المورد من القيمة الفعلية لأمر الشراء {purchase?.ref_no}
            ؛ لا تُدخل القيمة يدويًا ولا يمكن فوترة الأمر مرتين.
          </div>
          <Field name="ref_no" label="رقم فاتورة المورد" />
          <Field name="due_date" label="تاريخ الاستحقاق" type="date" />
        </>
      )}
      {kind === "work_order" && (
        <>
          <Field name="ref_no" label="رقم أمر العمل" />
          <Field name="title" label="المهمة المطلوبة" />
          <Pick name="asset_id" label="اللوحة" options={assets} />
          <Pick
            name="assigned_employee_id"
            label="الموظف المسؤول"
            options={people}
            required={false}
          />
          <Pick
            name="priority"
            label="الأولوية"
            value="normal"
            options={[
              { id: "low", name: "منخفضة" },
              { id: "normal", name: "عادية" },
              { id: "high", name: "عالية" },
              { id: "urgent", name: "عاجلة" },
            ]}
          />
          <Field name="due_date" label="موعد الإنجاز" type="date" />
          <Note name="description" label="تفاصيل العمل" required />
        </>
      )}
      {kind === "work_progress" && (
        <>
          <h3>
            {work?.ref_no} · {work?.title}
          </h3>
          <p>{work?.description}</p>
          <Pick
            name="status"
            label="الحالة الجديدة"
            options={
              work?.status === "in_progress"
                ? [
                    { id: "completed", name: "اكتمال العمل" },
                    { id: "cancelled", name: "إلغاء" },
                  ]
                : [
                    { id: "in_progress", name: "بدء التنفيذ" },
                    { id: "cancelled", name: "إلغاء" },
                  ]
            }
          />
          <Note
            name="resolution"
            label="وصف التقدم / المعالجة / سبب الإلغاء"
            required
          />
        </>
      )}
      {kind === "inspection" && (
        <InspectionFields data={d} initialTag={m.tag} />
      )}
      {kind === "asset_tag" && (
        <>
          <Pick name="asset_id" label="اللوحة" options={assets} />
          <Pick
            name="tag_kind"
            label="نوع كود التعريف"
            options={[
              { id: "qr", name: "QR" },
              { id: "nfc", name: "NFC" },
              { id: "rfid", name: "RFID (تسجيل المعرف فقط)" },
            ]}
          />
          <Field name="uid" label="رقم كود التعريف" />
          <p className="subtle">
            لـNFC سجّل الرقم التسلسلي المقروء من ملصق التعريف. توليد QR متاح بعد حفظ
            معرفه.
          </p>
        </>
      )}
      {kind === "cash" && (
        <>
          <PaymentMethodField />
          <label>
            نوع الحركة
            <select
              name="cash_kind"
              value={cashKind}
              onChange={(e) => setCashKind(e.target.value)}
            >
              <option value="expense">مصروف نقدي</option>
              <option value="income">إيراد نقدي مباشر</option>
              <option value="transfer">تحويل بين الخزائن والبنوك</option>
              {d.profile.role === "admin" && (
                <option value="opening">رصيد افتتاحي</option>
              )}
            </select>
          </label>
          <Field name="ref_no" label="رقم السند" />
          <Pick
            name="cash_account_id"
            label={cashKind === "transfer" ? "التحويل من" : "الخزينة / البنك"}
            options={cashAccounts}
          />
          {cashKind === "transfer" && (
            <Pick
              name="target_cash_account_id"
              label="التحويل إلى"
              options={cashAccounts}
            />
          )}{" "}
          {["expense", "income"].includes(cashKind) && (
            <Pick
              name="category_account_id"
              label={cashKind === "expense" ? "بند المصروف" : "بند الإيراد"}
              options={o.accounts
                .filter(
                  (a) =>
                    a.kind === (cashKind === "expense" ? "expense" : "revenue"),
                )
                .map((a) => ({ id: a.id, name: `${a.code} · ${a.name}` }))}
            />
          )}
          <div className="form-grid">
            <Field name="amount" label="القيمة" type="number" min="0.01" />
            <Field name="transaction_date" label="التاريخ" type="date" />
          </div>
          <Field name="description" label="البيان" />
          <Pick
            name="asset_id"
            label="اللوحة (اختياري)"
            options={assets}
            required={false}
          />
          <Pick
            name="work_order_id"
            label="أمر العمل (اختياري)"
            options={o.workOrders.map((w) => ({
              id: w.id,
              name: w.ref_no + " · " + w.title,
            }))}
            required={false}
          />
          <div className="notice">
            استخدم تسجيل دفعة الفاتورة لتحصيل أو سداد فاتورة؛ السند المباشر هنا
            لا يخصم رصيد فاتورة.
          </div>
        </>
      )}
      {kind === "adjustment" && (
        <>
          <Field name="ref_no" label="رقم قيد التسوية" />
          <Field name="entry_date" label="تاريخ القيد" type="date" />
          <Note name="description" label="بيان وسبب التسوية" required />
          <AdjustmentLines data={d} />
          <div className="notice">
            للتسويات غير النقدية. النقدية والعملاء والموردون والمخزون والرواتب
            تستخدم إجراءاتها المرتبطة للمحافظة على تطابق الأرصدة.
          </div>
        </>
      )}
      {kind === "ledger_account" && (
        <>
          <Field name="code" label="كود الحساب" />
          <Field name="name" label="اسم الحساب" />
          <Pick
            name="account_kind"
            label="تصنيف الحساب"
            options={[
              { id: "asset", name: "أصل" },
              { id: "liability", name: "التزام" },
              { id: "equity", name: "حقوق ملكية" },
              { id: "revenue", name: "إيراد" },
              { id: "expense", name: "مصروف" },
            ]}
          />
        </>
      )}
      {kind === "cash_account" && (
        <>
          <Field name="code" label="كود الحساب في دليل الحسابات" />
          <Field name="name" label="اسم الخزينة أو البنك" />
          <Pick
            name="account_kind"
            label="النوع"
            options={[
              { id: "cash", name: "خزينة نقدية" },
              { id: "bank", name: "حساب بنكي" },
            ]}
          />
          <p className="subtle">
            يبدأ برصيد صفر. أدخل الرصيد الافتتاحي من سند نقدية قبل أي حركة.
          </p>
        </>
      )}
      {kind === "enquiry_update" && (
        <>
          <div className="notice">
            {lead?.full_name} · {lead?.phone}
            <br />
            {lead?.message}
          </div>
          <Pick
            name="status"
            label="حالة المتابعة"
            value={lead?.status}
            options={[
              { id: "new", name: "جديد" },
              { id: "contacted", name: "تم التواصل" },
              { id: "qualified", name: "فرصة مؤهلة" },
              { id: "closed", name: "مغلق" },
            ]}
          />
          <Note value={lead?.notes || ""} />
        </>
      )}
    </DataForm>
  );
}
function PurchaseLines({ items }: { items: { id: string; name: string }[] }) {
  const [lines, setLines] = useState([
    { item_id: "", quantity: "1", unit_cost: "0" },
  ]);
  const update = (i: number, key: string, value: string) =>
    setLines(lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
  return (
    <div className="purchase-lines">
      <h3>بنود أمر الشراء</h3>
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines.map((l) => ({
            ...l,
            quantity: Number(l.quantity),
            unit_cost: Number(l.unit_cost),
          })),
        )}
      />
      {lines.map((l, i) => (
        <div className="purchase-line" key={i}>
          <label>
            الصنف
            <select
              required
              value={l.item_id}
              onChange={(e) => update(i, "item_id", e.target.value)}
            >
              <option value="">اختر…</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            الكمية
            <input lang="en" dir="ltr"
              type="number"
              min="0.001"
              step="any"
              required
              value={l.quantity}
              onChange={(e) => update(i, "quantity", e.target.value)}
            />
          </label>
          <label>
            سعر الوحدة
            <input lang="en" dir="ltr"
              type="number"
              min="0"
              step="0.0001"
              required
              value={l.unit_cost}
              onChange={(e) => update(i, "unit_cost", e.target.value)}
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="حذف البند"
            disabled={lines.length === 1}
            onClick={() => setLines(lines.filter((_, j) => j !== i))}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          setLines([...lines, { item_id: "", quantity: "1", unit_cost: "0" }])
        }
      >
        <Plus size={16} />
        إضافة بند
      </button>
      <p className="subtle">
        الإجمالي{" "}
        {egp(
          lines.reduce(
            (s, l) => s + Number(l.quantity) * Number(l.unit_cost),
            0,
          ),
        )}
      </p>
    </div>
  );
}
function InspectionFields({
  data: d,
  initialTag,
}: {
  data: WorkspaceData;
  initialTag?: string;
}) {
  const [method, setMethod] = useState(initialTag ? "qr" : "manual"),
    [tag, setTag] = useState(initialTag || ""),
    [message, setMessage] = useState(""),
    [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  async function scan() {
    const NFC = (
      window as unknown as {
        NDEFReader?: new () => {
          scan: () => Promise<void>;
          addEventListener: (
            name: string,
            fn: (e: { serialNumber: string }) => void,
          ) => void;
        };
      }
    ).NDEFReader;
    if (!NFC) {
      setMessage("Web NFC غير مدعوم هنا. استخدم QR أو أدخل رقم كود التعريف يدويًا.");
      return;
    }
    try {
      const reader = new NFC();
      await reader.scan();
      setMethod("nfc");
      setMessage("قرّب الهاتف من ملصق التعريف.");
      reader.addEventListener("reading", (e) => {
        setTag(e.serialNumber);
        setMessage("تمت قراءة المعرف. أكمل بيانات الزيارة ثم احفظ.");
      });
    } catch {
      setMessage("تعذرت قراءة NFC. تحقق من الصلاحية ودعم الجهاز.");
    }
  }
  const initialAsset = d.operations.assetTags.find(
    (t) => t.uid === initialTag,
  )?.asset_id;
  return (
    <>
      <Pick
        name="asset_id"
        label="اللوحة"
        value={initialAsset}
        options={d.assets.map((a) => ({
          id: a.id,
          name: `${a.code} · ${a.street_name}`,
        }))}
      />
      <Pick
        name="condition"
        label="نتيجة الفحص"
        options={[
          { id: "good", name: "جيدة" },
          { id: "needs_maintenance", name: "تحتاج صيانة" },
          { id: "damaged", name: "تالفة" },
          { id: "missing", name: "مفقودة" },
        ]}
      />
      <label>
        طريقة التحقق
        <select
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="manual">يدوي</option>
          <option value="qr">QR</option>
          <option value="nfc">NFC</option>
        </select>
      </label>
      {method !== "manual" && (
        <label>
          رقم كود التعريف
          <input
            name="tag_uid"
            required
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </label>
      )}
      <div className="inline-actions">
        <button type="button" className="button secondary" onClick={scan}>
          <Radio size={16} />
          قراءة NFC
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (p) =>
                setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
              () =>
                setMessage(
                  "لم تتوفر صلاحية الموقع. يمكنك إتمام الفحص دون إحداثيات.",
                ),
            )
          }
        >
          <LocateFixed size={16} />
          تسجيل موقعي
        </button>
      </div>
      {message && <div className="notice">{message}</div>}
      {coords && (
        <div className="notice">
          تم التقاط الموقع: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </div>
      )}
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      <Note label="تفاصيل الزيارة والملاحظات" required />
    </>
  );
}
function QrPreview({ data: d, id }: { data: WorkspaceData; id: string }) {
  const [src, setSrc] = useState(""),
    [url, setUrl] = useState("");
  const t = d.operations.assetTags.find((t) => t.id === id),
    asset = d.assets.find((a) => a.id === t?.asset_id);
  useEffect(() => {
    if (!t) return;
    const link =
      window.location.origin +
      (d.demo ? "/demo" : "/app") +
      "/inspections?tag=" +
      encodeURIComponent(t.uid);
    setUrl(link);
    let cancel = false;
    void import("qrcode")
      .then((QR) =>
        QR.toDataURL(link, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((result) => {
        if (!cancel) setSrc(result);
      });
    return () => {
      cancel = true;
    };
  }, [t, d.demo]);
  return (
    <div className="qr-preview">
      {src && <img src={src} alt={`رمز QR للوحة ${asset?.code}`} />}
      <h3>{asset?.code}</h3>
      <p>{asset?.street_name}</p>
      <code>{t?.uid}</code>
      <div className="inline-actions">
        <a
          className="button primary"
          download={`QR-${asset?.code}.png`}
          href={src}
        >
          <Download size={16} />
          تنزيل الرمز
        </a>
        <button className="button secondary" onClick={() => window.print()}>
          <Printer size={16} />
          طباعة
        </button>
      </div>
      <a className="subtle" href={url}>
        فتح صفحة الفحص المرتبطة
      </a>
    </div>
  );
}

function AdjustmentLines({ data: d }: { data: WorkspaceData }) {
  const [lines, setLines] = useState([
    { account: "", debit: "", credit: "" },
    { account: "", debit: "", credit: "" },
  ]);
  const accounts = d.operations.accounts.filter(
    (a) =>
      a.active &&
      !["1100", "1400", "2000", "2100", "2200"].includes(a.code) &&
      !d.operations.cashAccounts.some((c) => c.ledger_account_id === a.id),
  );
  const update = (index: number, key: string, value: string) =>
    setLines(lines.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  const debit = lines.reduce((s, l) => s + Number(l.debit), 0),
    credit = lines.reduce((s, l) => s + Number(l.credit), 0);
  return (
    <div className="purchase-lines">
      <input
        type="hidden"
        name="journal_lines"
        value={JSON.stringify(
          lines.map((l) => ({
            ...l,
            debit: Number(l.debit),
            credit: Number(l.credit),
          })),
        )}
      />
      {lines.map((l, i) => (
        <div className="purchase-line" key={i}>
          <label>
            الحساب
            <select
              required
              value={l.account}
              onChange={(e) => update(i, "account", e.target.value)}
            >
              <option value="">اختر…</option>
              {accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            مدين
            <input lang="en" dir="ltr"
              type="number"
              min="0"
              step="0.01"
              value={l.debit}
              onChange={(e) => update(i, "debit", e.target.value)}
            />
          </label>
          <label>
            دائن
            <input lang="en" dir="ltr"
              type="number"
              min="0"
              step="0.01"
              value={l.credit}
              onChange={(e) => update(i, "credit", e.target.value)}
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="حذف سطر القيد"
            disabled={lines.length <= 2}
            onClick={() => setLines(lines.filter((_, j) => i !== j))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          setLines([...lines, { account: "", debit: "", credit: "" }])
        }
      >
        <Plus size={16} />
        إضافة سطر
      </button>
      <p className="notice">
        المدين {egp(debit)} · الدائن {egp(credit)} · الفرق {egp(debit - credit)}
      </p>
    </div>
  );
}
