"use client";
import { paymentMethodLabel } from "@/lib/payment-methods.mjs";
import { useState, useMemo, useEffect } from "react";
import {
  Users,
  Clock3,
  Package,
  ShoppingCart,
  Wrench,
  ClipboardCheck,
  Landmark,
  BarChart3,
  MessageCircle,
  Inbox,
  History,
  Banknote,
  ArrowDownToLine,
  Search,
  Plus,
  QrCode,
} from "lucide-react";
import type { WorkspaceData } from "@/lib/types";
import { DataForm } from "./forms";
import { OperationForm } from "./operation-form";
import { Analytics } from "./analytics";
import {
  Panel,
  GridTable,
  State,
  Add,
  Mini,
  Dialog,
  egp,
  fmt,
  date,
  time,
  exportCsv,
} from "./ops-ui";
export const operationNavigation = [
  { id: "employees", label: "الموظفون", icon: Users, module: "employees" },
  {
    id: "attendance",
    label: "الحضور والإجازات",
    icon: Clock3,
    module: "attendance",
  },
  { id: "payroll", label: "الرواتب", icon: Banknote, module: "payroll" },
  {
    id: "inventory",
    label: "المخازن والمعدات",
    icon: Package,
    module: "inventory",
  },
  {
    id: "purchases",
    label: "المشتريات والتوريد",
    icon: ShoppingCart,
    module: "purchases",
  },
  {
    id: "maintenance",
    label: "التركيب والصيانة",
    icon: Wrench,
    module: "maintenance",
  },
  {
    id: "inspections",
    label: "المتابعة الميدانية",
    icon: ClipboardCheck,
    module: "inspections",
  },
  {
    id: "cashbook",
    label: "الخزينة والبنوك",
    icon: Landmark,
    module: "cashbook",
  },
  {
    id: "reports",
    label: "التقارير والتحليلات",
    icon: BarChart3,
    module: "reports",
  },
  {
    id: "whatsapp",
    label: "تذكيرات واتساب",
    icon: MessageCircle,
    module: "whatsapp",
  },
  { id: "leads", label: "طلبات العملاء", icon: Inbox, module: "leads" },
  { id: "audit", label: "سجل التعديلات", icon: History, module: "audit" },
];
export type OperationModal = { kind: string; id?: string; tag?: string };
export function Operations({
  data: d,
  section,
}: {
  data: WorkspaceData;
  section: string;
}) {
  const o = d.operations,
    [modal, setModal] = useState<OperationModal | null>(null),
    [tab, setTab] = useState("main"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const hr = ["admin", "hr"].includes(d.profile.role),
    finance = ["admin", "accounts", "accountant"].includes(d.profile.role),
    stock = ["admin", "storekeeper", "area_manager"].includes(d.profile.role),
    ops = ["admin", "area_manager", "supervisor"].includes(d.profile.role),
    field = ops || d.profile.role === "inspector";
  const emp = (id: string | null) =>
      o.employeeDirectory.find((e) => e.id === id)?.full_name || "—",
    asset = (id: string | null) =>
      d.assets.find((a) => a.id === id)?.code || "—",
    warehouse = (id: string | null) =>
      o.warehouses.find((w) => w.id === id)?.name || "—",
    item = (id: string) => o.items.find((i) => i.id === id)?.name || "—",
    cash = (id: string) => o.cashAccounts.find((c) => c.id === id)?.name || "—";
  const matches = (value: unknown) =>
    JSON.stringify(value).toLowerCase().includes(search.toLowerCase());
  const open = (kind: string, id?: string) => setModal({ kind, id });
  const linkAction = (label: string, kind: string, id: string) => (
    <button className="text-button" onClick={() => open(kind, id)}>
      {label}
    </button>
  );
  useEffect(() => {
    setTab("main");
    setFilter("all");
    setSearch("");
    setModal(null);
    if (section === "inspections") {
      const tag = new URLSearchParams(window.location.search).get("tag");
      if (tag) setModal({ kind: "inspection", tag });
    }
  }, [section]);
  const tools = (actions: React.ReactNode) => (
    <div className="ops-toolbar">
      <div className="search-box">
        <Search size={17} />
        <input
          aria-label="بحث في الوحدة"
          placeholder="ابحث في السجلات…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="inline-actions">{actions}</div>
    </div>
  );
  const tabs = (values: { id: string; label: string }[]) => (
    <div className="ops-tabs" role="tablist">
      {values.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          className={tab === t.id ? "active" : ""}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
  const workCost = (id: string) =>
    o.stockMoves
      .filter((m) => m.work_order_id === id && m.kind === "issue")
      .reduce((s, m) => s + Number(m.quantity) * Number(m.unit_cost), 0) +
    o.cashTransactions
      .filter((t) => t.work_order_id === id && t.kind === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
  return (
    <div className="operations-content">
      {section === "reports" ? <Analytics data={d} full /> : null}
      {section === "employees" && (
        <>
          <div className="ops-metrics">
            <Mini
              label="الموظفون النشطون"
              value={fmt(
                o.employeeDirectory.filter((e) => e.status === "active").length,
              )}
            />
            <Mini
              label="الأقسام"
              value={fmt(
                new Set(o.employeeDirectory.map((e) => e.department)).size,
              )}
            />
            {hr && (
              <Mini
                label="إجمالي الرواتب الأساسية"
                value={egp(
                  o.employees
                    .filter((e) => e.status === "active")
                    .reduce((s, e) => s + Number(e.base_salary || 0), 0),
                )}
              />
            )}
          </div>
          {tools(hr && <Add onClick={() => open("employee")}>إضافة موظف</Add>)}
          <Panel
            title="دليل الموظفين"
            subtitle="بيانات الرواتب والتواصل التفصيلية متاحة للأدوار المخولة فقط"
          >
            <GridTable
              columns={[
                "الكود",
                "الاسم",
                "القسم / الوظيفة",
                "المنطقة",
                "الحالة",
                "",
              ]}
              rows={o.employeeDirectory.filter(matches).map((e) => [
                e.code,
                <strong key="n">{e.full_name}</strong>,
                <span key="job">
                  {e.department}
                  <small className="cell-sub">{e.job_title}</small>
                </span>,
                d.districts.find((x) => x.id === e.district_id)?.name || "عام",
                <State key="s" value={e.status} />,
                hr ? linkAction("الملف والتعديل", "employee", e.id) : null,
              ])}
            />
          </Panel>
        </>
      )}
      {section === "attendance" && (
        <>
          {tools(
            <>
              <Add onClick={() => open("attendance_clock")}>
                إثبات حضور / انصراف
              </Add>
              {hr && (
                <button
                  className="button secondary"
                  onClick={() => open("attendance_manual")}
                >
                  إدخال / تصحيح يدوي
                </button>
              )}
              <button
                className="button secondary"
                onClick={() => open("leave")}
              >
                طلب إجازة
              </button>
            </>,
          )}
          {tabs([
            { id: "main", label: "سجل الحضور" },
            { id: "leaves", label: "طلبات الإجازات" },
          ])}
          {tab === "main" ? (
            <Panel
              title="الحضور والانصراف"
              subtitle="الساعات بتوقيت القاهرة؛ أي تصحيح يدوي يُسجل مع سببه"
            >
              <GridTable
                columns={[
                  "الموظف",
                  "اليوم",
                  "الحضور",
                  "الانصراف",
                  "الساعات",
                  "ملاحظات",
                ]}
                rows={o.attendance
                  .filter((r) => matches({ ...r, name: emp(r.employee_id) }))
                  .sort((a, b) => b.work_date.localeCompare(a.work_date))
                  .map((a) => [
                    emp(a.employee_id),
                    date(a.work_date),
                    time(a.check_in),
                    time(a.check_out),
                    a.check_out
                      ? fmt(
                          (new Date(a.check_out).getTime() -
                            new Date(a.check_in).getTime()) /
                            3600000,
                        )
                      : "مفتوح",
                    a.notes || "—",
                  ])}
              />
            </Panel>
          ) : (
            <Panel
              title="طلبات الإجازات"
              subtitle="عدد الأيام تقويمي؛ سياسات الاستحقاق القانونية تُضبط وفق لائحة شركتك"
            >
              <GridTable
                columns={["الموظف", "من", "إلى", "النوع", "الحالة", "الإجراء"]}
                rows={o.leaves
                  .filter((r) => matches({ ...r, name: emp(r.employee_id) }))
                  .map((l) => [
                    emp(l.employee_id),
                    date(l.start_date),
                    date(l.end_date),
                    (
                      {
                        annual: "سنوية",
                        sick: "مرضية",
                        unpaid: "دون راتب",
                        other: "أخرى",
                      } as Record<string, string>
                    )[l.kind],
                    <State key="s" value={l.status} />,
                    hr && l.status === "pending"
                      ? linkAction("مراجعة الطلب", "leave_decision", l.id)
                      : l.decision_note || "—",
                  ])}
              />
            </Panel>
          )}
        </>
      )}
      {section === "payroll" && (
        <>
          <div className="ops-metrics">
            <Mini
              label="مسودات الرواتب"
              value={egp(
                o.payroll
                  .filter((p) => p.status === "draft")
                  .reduce((s, p) => s + Number(p.net_amount), 0),
              )}
            />
            <Mini
              label="مستحق للصرف"
              value={egp(
                o.payroll
                  .filter((p) => p.status === "approved")
                  .reduce((s, p) => s + Number(p.net_amount), 0),
              )}
            />
            <Mini
              label="رواتب مصروفة"
              value={egp(
                o.payroll
                  .filter((p) => p.status === "paid")
                  .reduce((s, p) => s + Number(p.net_amount), 0),
              )}
            />
          </div>
          {tools(hr && <Add onClick={() => open("payroll")}>إعداد راتب</Add>)}
          <Panel
            title="كشف الرواتب"
            subtitle="أساس + مكافآت − خصومات. الاعتماد يُرحّل الاستحقاق، والصرف يُرحّل حركة الخزينة؛ لا تُفترض ضرائب أو تأمينات"
          >
            <GridTable
              columns={[
                "الفترة",
                "الموظف",
                "الأساس",
                "المكافآت",
                "الخصومات",
                "الصافي",
                "الحالة",
                "",
              ]}
              rows={o.payroll
                .filter((r) => matches({ ...r, name: emp(r.employee_id) }))
                .map((p) => [
                  date(p.period),
                  emp(p.employee_id),
                  egp(p.base_amount),
                  egp(p.bonus),
                  egp(p.deductions),
                  <strong key="v">{egp(p.net_amount)}</strong>,
                  <State key="s" value={p.status} />,
                  p.status === "draft" && hr
                    ? linkAction("اعتماد الراتب", "payroll_settle", p.id)
                    : p.status === "approved" && finance
                      ? linkAction("صرف الراتب", "payroll_settle", p.id)
                      : date(p.paid_on),
                ])}
            />
          </Panel>
        </>
      )}
      {section === "inventory" && (
        <>
          <div className="ops-metrics">
            <Mini label="المخازن" value={fmt(o.warehouses.length)} />
            <Mini label="الأصناف" value={fmt(o.items.length)} />
            <Mini
              label="قيمة الرصيد"
              value={egp(
                o.stockBalances.reduce(
                  (s, r) => s + Number(r.inventory_value),
                  0,
                ),
              )}
            />
            <Mini
              label="عند حد إعادة الطلب"
              value={fmt(o.stockBalances.filter((r) => r.low_stock).length)}
            />
          </div>
          {tools(
            stock && (
              <>
                <Add onClick={() => open("stock")}>حركة مخزون</Add>
                <button
                  className="button secondary"
                  onClick={() => open("item")}
                >
                  إضافة صنف
                </button>
                <button
                  className="button secondary"
                  onClick={() => open("warehouse")}
                >
                  إضافة مخزن
                </button>
              </>
            ),
          )}
          {tabs([
            { id: "main", label: "الأرصدة والتكلفة" },
            { id: "movements", label: "سجل الحركات" },
            { id: "warehouses", label: "المخازن" },
            { id: "items", label: "دليل الأصناف" },
          ])}
          {tab === "main" && (
            <Panel
              title="رصيد المخزون"
              subtitle="الرصيد محسوب من الحركات؛ تكلفة الصرف والتحويل بالمتوسط المرجح"
            >
              <GridTable
                columns={[
                  "الصنف",
                  "المخزن",
                  "الكمية",
                  "الوحدة",
                  "متوسط التكلفة",
                  "قيمة الرصيد",
                  "إعادة الطلب",
                ]}
                rows={o.stockBalances.filter(matches).map((r) => [
                  <span key="n">
                    {r.item_name}
                    <small className="cell-sub">{r.sku}</small>
                  </span>,
                  r.warehouse_name,
                  fmt(r.quantity),
                  r.unit,
                  egp(r.average_cost),
                  egp(r.inventory_value),
                  r.low_stock ? (
                    <State key="l" value="urgent" />
                  ) : (
                    fmt(r.reorder_level)
                  ),
                ])}
              />
            </Panel>
          )}
          {tab === "movements" && (
            <Panel
              title="سجل حركات المخزون"
              subtitle="حركات غير قابلة للتعديل؛ أي تصحيح يتم بحركة عكسية موثقة"
            >
              <GridTable
                columns={[
                  "المرجع",
                  "التاريخ",
                  "الصنف",
                  "النوع",
                  "من",
                  "إلى",
                  "الكمية",
                  "التكلفة",
                  "اللوحة / أمر العمل",
                ]}
                rows={o.stockMoves
                  .filter((r) => matches({ ...r, name: item(r.item_id) }))
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((m) => [
                    m.ref_no,
                    date(m.created_at),
                    item(m.item_id),
                    (
                      {
                        receipt: "توريد",
                        issue: "صرف",
                        transfer: "تحويل",
                        return: "مرتجع",
                        adjustment_in: "زيادة جرد",
                        adjustment_out: "عجز جرد",
                      } as Record<string, string>
                    )[m.kind],
                    warehouse(m.from_warehouse_id),
                    warehouse(m.to_warehouse_id),
                    fmt(m.quantity),
                    egp(Number(m.quantity) * Number(m.unit_cost)),
                    asset(m.asset_id),
                  ])}
              />
            </Panel>
          )}
          {tab === "warehouses" && (
            <Panel title="المخازن حسب المنطقة">
              <GridTable
                columns={["الكود", "الاسم", "المنطقة", "العنوان"]}
                rows={o.warehouses
                  .filter(matches)
                  .map((w) => [
                    w.code,
                    w.name,
                    d.districts.find((x) => x.id === w.district_id)?.name ||
                      "—",
                    w.address || "—",
                  ])}
              />
            </Panel>
          )}
          {tab === "items" && (
            <Panel title="دليل المعدات والخامات">
              <GridTable
                columns={["SKU", "الصنف", "الوحدة", "حد إعادة الطلب"]}
                rows={o.items
                  .filter(matches)
                  .map((i) => [i.sku, i.name, i.unit, fmt(i.reorder_level)])}
              />
            </Panel>
          )}
        </>
      )}
      {section === "purchases" && (
        <>
          {tools(
            stock && <Add onClick={() => open("purchase")}>أمر شراء جديد</Add>,
          )}
          <Panel
            title="أوامر الشراء والتوريد"
            subtitle="الاستلام يزيد المخزون، ثم تُنشأ فاتورة المورد من الأمر نفسه مرة واحدة"
          >
            <GridTable
              columns={[
                "المرجع",
                "المورد",
                "المخزن",
                "تاريخ الطلب",
                "القيمة",
                "الحالة",
                "",
              ]}
              rows={o.purchases.filter(matches).map((p) => [
                p.ref_no,
                d.parties.find((a) => a.id === p.supplier_id)?.name || "—",
                warehouse(p.warehouse_id),
                date(p.ordered_on),
                egp(
                  o.purchaseLines
                    .filter((l) => l.purchase_id === p.id)
                    .reduce(
                      (s, l) => s + Number(l.quantity) * Number(l.unit_cost),
                      0,
                    ),
                ),
                <State key="s" value={p.status} />,
                <span key="a" className="row-actions">
                  {linkAction("التفاصيل", "purchase_detail", p.id)}
                  {stock &&
                    p.status === "ordered" &&
                    linkAction("استلام", "purchase_receive", p.id)}
                  {finance &&
                    p.status === "received" &&
                    linkAction("فاتورة المورد", "purchase_invoice", p.id)}
                </span>,
              ])}
            />
          </Panel>
        </>
      )}
      {section === "maintenance" && (
        <>
          <div className="ops-metrics">
            <Mini
              label="أوامر مفتوحة"
              value={fmt(
                o.workOrders.filter((w) =>
                  ["open", "assigned"].includes(w.status),
                ).length,
              )}
            />
            <Mini
              label="جارٍ التنفيذ"
              value={fmt(
                o.workOrders.filter((w) => w.status === "in_progress").length,
              )}
            />
            <Mini
              label="مكتمل"
              value={fmt(
                o.workOrders.filter((w) => w.status === "completed").length,
              )}
            />
            <Mini
              label="تكلفة مسجلة للأوامر"
              value={egp(o.workOrders.reduce((s, w) => s + workCost(w.id), 0))}
            />
          </div>
          {tools(
            ops && <Add onClick={() => open("work_order")}>أمر عمل جديد</Add>,
          )}
          <Panel
            title="أوامر الصيانة والتركيب"
            subtitle="التكلفة تجمع قيمة المعدات المصروفة والمصروفات النقدية المرتبطة بأمر العمل"
          >
            <GridTable
              columns={[
                "المرجع / المهمة",
                "اللوحة",
                "المسؤول",
                "الموعد",
                "الأولوية",
                "الحالة",
                "التكلفة",
                "",
              ]}
              rows={o.workOrders.filter(matches).map((w) => [
                <span key="title">
                  {w.ref_no}
                  <small className="cell-sub">{w.title}</small>
                </span>,
                asset(w.asset_id),
                emp(w.assigned_employee_id),
                date(w.due_date),
                <State key="p" value={w.priority} />,
                <State key="s" value={w.status} />,
                egp(workCost(w.id)),
                !["completed", "cancelled"].includes(w.status)
                  ? linkAction("متابعة التنفيذ", "work_progress", w.id)
                  : w.resolution || "—",
              ])}
            />
          </Panel>
        </>
      )}
      {section === "inspections" && (
        <>
          {tools(
            <>
              {field && (
                <Add onClick={() => open("inspection")}>تسجيل فحص ميداني</Add>
              )}
              {ops && (
                <button
                  className="button secondary"
                  onClick={() => open("asset_tag")}
                >
                  ربط كود تعريف QR / NFC
                </button>
              )}
            </>,
          )}
          {tabs([
            { id: "main", label: "سجل الفحص" },
            { id: "tags", label: "أكواد تعريف اللوحات" },
          ])}
          {tab === "main" ? (
            <Panel
              title="الزيارات والفحص الميداني"
              subtitle="النتائج غير السليمة تسجل حادثًا على اللوحة للمراجعة"
            >
              <GridTable
                columns={[
                  "اللوحة",
                  "تاريخ الزيارة",
                  "الحالة",
                  "طريقة التحقق",
                  "الملاحظات",
                ]}
                rows={o.inspections
                  .filter(matches)
                  .map((i) => [
                    asset(i.asset_id),
                    date(i.checked_at),
                    <State key="s" value={i.condition} />,
                    i.method.toUpperCase(),
                    i.notes,
                  ])}
              />
            </Panel>
          ) : (
            <Panel
              title="أكواد التعريف وربطها باللوحات"
              subtitle="QR يعمل على جميع الهواتف عبر رابط الفحص؛ قراءة NFC حسب دعم المتصفح والجهاز"
            >
              <GridTable
                columns={["اللوحة", "النوع", "رقم كود التعريف", "الحالة", ""]}
                rows={o.assetTags.filter(matches).map((t) => [
                  asset(t.asset_id),
                  t.kind.toUpperCase(),
                  <span className="code" key="uid">
                    {t.uid}
                  </span>,
                  t.active ? "مفعّل" : "معطّل",
                  t.kind === "qr" ? (
                    <button
                      className="text-button"
                      onClick={() => open("qr_preview", t.id)}
                    >
                      <QrCode size={16} />
                      عرض وطباعة
                    </button>
                  ) : null,
                ])}
              />
            </Panel>
          )}
        </>
      )}
      {section === "cashbook" && (
        <>
          {finance ? (
            <>
              <div className="ops-metrics">
                {o.cashAccounts.map((a) => (
                  <Mini
                    key={a.id}
                    label={a.name}
                    value={egp(a.balance)}
                    help={a.kind === "bank" ? "حساب بنكي" : "خزينة نقدية"}
                  />
                ))}
              </div>
              {tools(
                <>
                  <Add onClick={() => open("cash")}>إيراد / مصروف / تحويل</Add>
                  <button
                    className="button secondary"
                    onClick={() => open("adjustment")}
                  >
                    قيد تسوية
                  </button>
                  {d.profile.role === "admin" && (
                    <button
                      className="button secondary"
                      onClick={() => open("cash_account")}
                    >
                      خزينة أو بنك
                    </button>
                  )}
                  <button
                    className="button secondary"
                    onClick={() => open("ledger_account")}
                  >
                    حساب بدليل الحسابات
                  </button>
                </>,
              )}
              {tabs([
                { id: "main", label: "حركات الخزينة والبنك" },
                { id: "journal", label: "القيود اليومية" },
                { id: "accounts", label: "دليل الحسابات" },
              ])}
              {tab === "main" && (
                <Panel
                  title="حركات الخزائن والبنوك"
                  subtitle="الفواتير تُثبت الاستحقاق؛ المقبوضات والمدفوعات تُثبت حركة النقدية"
                >
                  <GridTable
                    columns={[
                      "المرجع",
                      "التاريخ",
                      "الخزينة / البنك",
                      "النوع",
                      "البيان",
                      "طريقة العملية",
                      "القيمة",
                    ]}
                    rows={o.cashTransactions
                      .filter(matches)
                      .sort((a, b) =>
                        b.transaction_date.localeCompare(a.transaction_date),
                      )
                      .map((t) => [
                        t.ref_no,
                        date(t.transaction_date),
                        cash(t.cash_account_id),
                        (
                          {
                            income: "إيراد مباشر",
                            expense: "مصروف",
                            transfer: "تحويل داخلي",
                            opening: "رصيد افتتاحي",
                            receipt: "تحصيل فاتورة",
                            payment: "سداد فاتورة",
                            salary: "صرف راتب",
                          } as Record<string, string>
                        )[t.kind],
                        t.description,
                        paymentMethodLabel(t.payment_method),
                        egp(t.amount),
                      ])}
                  />
                </Panel>
              )}
              {tab === "journal" && (
                <Panel
                  title="سجل القيود"
                  subtitle="اضغط على القيد لمراجعة الحسابات المدينة والدائنة"
                >
                  <GridTable
                    columns={["المرجع", "التاريخ", "البيان", "المصدر", ""]}
                    rows={o.journals
                      .filter(matches)
                      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
                      .map((j) => [
                        j.ref_no,
                        date(j.entry_date),
                        j.description,
                        j.source_kind,
                        linkAction("تفاصيل القيد", "journal_detail", j.id),
                      ])}
                  />
                </Panel>
              )}
              {tab === "accounts" && (
                <Panel title="دليل الحسابات">
                  <GridTable
                    columns={[
                      "الكود",
                      "اسم الحساب",
                      "التصنيف",
                      "مدين",
                      "دائن",
                      "الرصيد",
                    ]}
                    rows={o.trialBalance
                      .filter(matches)
                      .map((a) => [
                        a.code,
                        a.name,
                        (
                          {
                            asset: "أصل",
                            liability: "التزام",
                            equity: "حقوق ملكية",
                            revenue: "إيراد",
                            expense: "مصروف",
                          } as Record<string, string>
                        )[a.kind],
                        egp(a.debit),
                        egp(a.credit),
                        egp(a.balance),
                      ])}
                  />
                </Panel>
              )}
            </>
          ) : (
            <div className="notice">
              الحسابات المالية متاحة للأدوار المخولة فقط.
            </div>
          )}
        </>
      )}
      {section === "whatsapp" && (
        <>
          {d.profile.role === "admin" ? (
            <>
              <div className="notice">
                تُجهّز التذكيرات عند بقاء 60 / 30 / 7 يومًا بشرط موافقة المستلم.
                الحالة «أُرسل إلى Meta» تعني قبول طلب الإرسال؛ تأكيد التسليم
                يحتاج Webhook. لا تعاد محاولة النتائج غير المؤكدة تلقائيًا.
              </div>
              <div className="ops-metrics">
                <Mini
                  label="قيد الانتظار"
                  value={fmt(
                    o.reminders.filter((r) => r.status === "pending").length,
                  )}
                />
                <Mini
                  label="طلبات إرسال مقبولة"
                  value={fmt(
                    o.reminders.filter((r) => r.status === "sent").length,
                  )}
                />
                <Mini
                  label="تحتاج مراجعة"
                  value={fmt(
                    o.reminders.filter((r) =>
                      ["failed", "uncertain", "processing"].includes(r.status),
                    ).length,
                  )}
                />
              </div>
              <details className="card padded">
                <summary>تجهيز تذكيرات اليوم</summary>
                <DataForm
                  kind="reminders_queue"
                  demo={d.demo}
                  label="تجهيز المستحق اليوم"
                >
                  <p className="subtle">
                    يضيف المستحق اليوم لقائمة الانتظار فقط. الإرسال الفعلي ينفذه
                    العامل المجدول بعد ضبط خدمة Meta.
                  </p>
                </DataForm>
              </details>
              <Panel title="سجل تذكيرات التجديد">
                <GridTable
                  columns={[
                    "المعلن",
                    "العقد",
                    "الأيام المتبقية",
                    "التجديد",
                    "الحالة",
                    "نتيجة الخدمة",
                  ]}
                  rows={o.reminders
                    .filter(matches)
                    .map((r) => [
                      d.parties.find((p) => p.id === r.party_id)?.name || "—",
                      d.contracts.find((c) => c.id === r.contract_id)?.ref_no ||
                        r.contract_id,
                      fmt(r.days_before),
                      date(r.renewal_date),
                      <State key="s" value={r.status} />,
                      r.last_error || r.provider_message_id || "—",
                    ])}
                />
              </Panel>
            </>
          ) : (
            <div className="notice">سجل الإرسال متاح لمدير النظام.</div>
          )}
        </>
      )}
      {section === "leads" && (
        <>
          {tools(null)}
          <Panel
            title="طلبات عروض الأسعار من الموقع"
            subtitle="طلبات زوار موقع الشركة مع حالة متابعة داخلية"
          >
            <GridTable
              columns={[
                "الاسم",
                "التواصل",
                "اللوحة",
                "الطلب",
                "الحالة",
                "التاريخ",
                "",
              ]}
              rows={o.enquiries.filter(matches).map((l) => [
                l.full_name,
                <span dir="ltr" key="p">
                  {l.phone}
                </span>,
                l.asset_code || "—",
                <span key="m" className="wrap-cell">
                  {l.message}
                </span>,
                <State key="s" value={l.status} />,
                date(l.created_at),
                linkAction("متابعة الطلب", "enquiry_update", l.id),
              ])}
            />
          </Panel>
        </>
      )}
      {section === "audit" && (
        <>
          {d.profile.role === "admin" ? (
            <>
              {tools(
                <button
                  className="button secondary"
                  onClick={() =>
                    exportCsv(
                      "mesk-audit",
                      ["التاريخ", "الجدول", "السجل", "العملية", "المستخدم"],
                      o.audit.map((a) => [
                        a.created_at,
                        a.table_name,
                        a.record_id,
                        a.operation,
                        a.actor_id,
                      ]),
                    )
                  }
                >
                  <ArrowDownToLine size={16} />
                  تصدير السجل
                </button>,
              )}
              <Panel
                title="سجل التعديلات"
                subtitle="تسجيل تلقائي للتغييرات والمستخدم وتوقيتها؛ السجل غير قابل للتعديل من التطبيق"
              >
                <GridTable
                  columns={[
                    "التاريخ",
                    "الوحدة / الجدول",
                    "الإجراء",
                    "المستخدم",
                    "",
                  ]}
                  rows={o.audit
                    .filter(matches)
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((a) => [
                      date(a.created_at) + " · " + time(a.created_at),
                      a.table_name,
                      a.operation,
                      a.actor_id?.slice(0, 8) || "خدمة النظام",
                      linkAction("التغييرات", "audit_detail", a.id),
                    ])}
                />
              </Panel>
            </>
          ) : (
            <div className="notice">سجل التعديلات متاح لمدير النظام.</div>
          )}
        </>
      )}
      {modal && (
        <Dialog
          title={
            modal.kind.endsWith("_detail")
              ? "تفاصيل السجل"
              : modal.kind === "qr_preview"
                ? "كود تعريف اللوحة"
                : "إدارة السجل"
          }
          onClose={() => setModal(null)}
        >
          <OperationForm modal={modal} data={d} />
        </Dialog>
      )}
    </div>
  );
}
