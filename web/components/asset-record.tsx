"use client";
import { MapPin } from "lucide-react";
import type { Asset, WorkspaceData } from "@/lib/types";
import { statuses } from "@/lib/types";
import { DataForm } from "./forms";
import { GridTable, State, date, egp } from "./ops-ui";

export function AssetRecord({ asset: a, data: d, canEdit, canFinance }: {
  asset: Asset; data: WorkspaceData; canEdit: boolean; canFinance: boolean;
}) {
  const o = d.operations;
  const lines = o.contractLines.filter((r) => r.asset_id === a.id);
  const work = o.workOrders.filter((r) => r.asset_id === a.id);
  const inspections = o.inspections.filter((r) => r.asset_id === a.id);
  const licenses = d.licenses.filter((r) => r.asset_id === a.id);
  const stock = o.stockMoves.filter((r) => r.asset_id === a.id);
  const cash = o.cashTransactions.filter((r) => r.asset_id === a.id);
  const audit = o.audit.filter((r) => r.table_name === "assets" && r.record_id === a.id);
  const money = (n: number | null | undefined) => n == null ? "—" : egp(n);
  return <div className="asset-detail asset-record">
    <span className={`badge ${a.live_status}`}>{statuses[a.live_status]}</span>
    <h2>{a.street_name}</h2><p>{a.district_name}</p>
    <dl>{[
      ["نوع الأصل", a.type_name],
      ["الأبعاد", `${a.length_m || "—"} × ${a.width_m || "—"} م`],
      ["الأوجه / المعدن", `${a.faces} / ${a.material || "—"}`],
      ["الإيجار الشهري", money(a.monthly_price)],
      ["التكلفة الشهرية", money(a.monthly_cost)],
      ["نهاية الإيجار", date(a.lease_end)], ["نهاية التغطية", date(a.coverage_end)],
      ["تكلفة الاقتناء", money(a.cost)], ["تاريخ التركيب", date(a.install_date)],
      ["العمر الإنتاجي بالأشهر", a.useful_life_months || "—"],
      ["الإهلاك الشهري التقديري", a.cost != null && a.useful_life_months ? money(a.cost / a.useful_life_months) : "—"],
      ["الظهور في الموقع", a.public_visible && a.live_status !== "retired" ? "منشور" : "غير منشور"],
    ].map(([key, value]) => <div key={String(key)}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    {a.notes && <p className="notice">{a.notes}</p>}
    {a.latitude != null && a.longitude != null && <a className="button secondary" target="_blank" rel="noreferrer"
      href={`https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=17/${a.latitude}/${a.longitude}`}>
      <MapPin size={17}/>فتح الموقع على الخريطة</a>}
    {a.chain_conflict && <p className="notice danger">تعارض في تغطية العقد الصاعد. راجع السلسلة التعاقدية.</p>}
    {canEdit && <details className="asset-section"><summary>تعديل حالة الأصل وبيانات الاقتناء</summary>
      <DataForm kind="asset_update" demo={d.demo} label="حفظ تعديلات الأصل">
        <input type="hidden" name="id" value={a.id}/>
        <label>حالة الأصل<select name="status" defaultValue={a.status || (a.live_status === "maintenance" ? "maintenance" : a.live_status === "retired" ? "retired" : "active")}>
          <option value="active">نشط</option><option value="maintenance">صيانة</option><option value="retired">مستبعد</option>
        </select></label>
        <div className="form-grid">
          <label>تكلفة الاقتناء (ج.م)<input lang="en" dir="ltr" type="number" name="cost" min="0" step="0.01" defaultValue={a.cost ?? ""}/></label>
          <label>تاريخ التركيب<input lang="en" dir="ltr" type="date" name="install_date" defaultValue={a.install_date || ""}/></label>
          <label>العمر الإنتاجي بالأشهر<input lang="en" dir="ltr" type="number" name="useful_life_months" min="1" step="1" defaultValue={a.useful_life_months ?? ""}/></label>
        </div>
        <label>ملاحظات<textarea name="notes" maxLength={5000} defaultValue={a.notes || ""}/></label>
        <label className="check-label"><input type="checkbox" name="public_visible" defaultChecked={a.public_visible}/>إظهار الأصل في الموقع العام</label>
        <p className="subtle">الاستبعاد لا يحذف السجل، ويحتاج انتهاء أو إلغاء الحجوزات الحالية والمستقبلية. الإهلاك تقديري؛ لا يُرحّل قيدًا محاسبيًا.</p>
      </DataForm>
    </details>}
    <details className="asset-section" open><summary>العقود والحجوزات · {lines.length}</summary>
      <GridTable columns={["العقد / المعلن", "الفترة", "الإيجار الشهري", "الحالة"]} rows={lines.map((r) => {
        const c = d.contracts.find((c) => c.id === r.contract_id);
        const party = d.parties.find((p) => p.id === c?.customer_id);
        return [<span key={r.id}>{c?.ref_no || "عقد"}<small>{party?.name || "—"}</small></span>, `${date(r.start_date)} — ${date(r.end_date)}`, egp(r.monthly_price), statuses[r.status] || r.status];
      })}/>
    </details>
    <details className="asset-section"><summary>الصيانة وأوامر العمل · {work.length}</summary>
      <GridTable columns={["أمر العمل", "المسؤول", "الاستحقاق", "الحالة / الإغلاق"]} rows={work.map((r) => [
        <span key={r.id}>{r.ref_no}<small>{r.title}</small></span>, o.employeeDirectory.find((e) => e.id === r.assigned_employee_id)?.full_name || "غير مسند",
        date(r.due_date), <span key={r.id}><State value={r.status}/><small>{r.resolution}</small></span>,
      ])}/>
    </details>
    <details className="asset-section"><summary>الفحص الميداني · {inspections.length}</summary>
      <GridTable columns={["التاريخ", "حالة الأصل", "طريقة الفحص", "الملاحظات"]} rows={inspections.map((r) => [date(r.checked_at), <State key={r.id} value={r.condition}/>, r.method === "manual" ? "يدوي" : r.method.toUpperCase(), r.notes || "—"])}/>
    </details>
    <details className="asset-section"><summary>التراخيص · {licenses.length}</summary>
      <GridTable columns={["المرجع", "الجهة المصدرة", "الانتهاء"]} rows={licenses.map((r) => [r.ref_no,r.issuer,date(r.expires_on)])}/>
    </details>
    <details className="asset-section"><summary>المعدات وحركات المخزون · {stock.length}</summary>
      <GridTable columns={["المرجع", "الصنف", "الحركة", "الكمية", ...(canFinance ? ["القيمة"] : [])]} rows={stock.map((r) => [
        r.ref_no, o.items.find((i) => i.id === r.item_id)?.name || "—", ({issue:"صرف", return:"مرتجع", receipt:"توريد", transfer:"تحويل", adjustment:"جرد"} as Record<string,string>)[r.kind] || r.kind,
        r.quantity, ...(canFinance ? [egp(r.quantity * r.unit_cost)] : []),
      ])}/>
    </details>
    {canFinance && <details className="asset-section"><summary>حركات النقدية المرتبطة · {cash.length}</summary>
      <GridTable columns={["المرجع", "التاريخ", "البيان", "النوع", "القيمة"]} rows={cash.map((r) => [r.ref_no, date(r.transaction_date), r.description, ({income:"إيراد",expense:"مصروف",transfer:"تحويل"} as Record<string,string>)[r.kind] || r.kind,egp(r.amount)])}/>
    </details>}
    {d.profile.role === "admin" && <details className="asset-section"><summary>سجل تعديلات الأصل · {audit.length}</summary>
      <GridTable columns={["التاريخ", "الإجراء", "المستخدم"]} rows={audit.map((r) => [date(r.created_at), ({INSERT:"إنشاء",UPDATE:"تعديل",DELETE:"حذف"} as Record<string,string>)[r.operation] || r.operation, o.tenantUsers.find((u) => u.id === r.actor_id)?.full_name || "إجراء نظام"] )}/>
    </details>}
  </div>;
}
