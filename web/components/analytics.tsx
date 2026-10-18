"use client";
import { useMemo, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import type { WorkspaceData } from "@/lib/types";
import { Panel, Mini, GridTable, egp, fmt, exportCsv } from "./ops-ui";
export function Analytics({
  data: d,
  full = false,
}: {
  data: WorkspaceData;
  full?: boolean;
}) {
  const [months, setMonths] = useState("6"),
    [hover, setHover] = useState<number | null>(null);
  const series = useMemo(
    () =>
      Array.from({ length: Number(months) }, (_, i) => {
        const date = new Date();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() - (Number(months) - i - 1));
        const key = date.toISOString().slice(0, 7);
        const row = d.operations.cashflow.find(
          (r) => r.month.slice(0, 7) === key,
        );
        return {
          key,
          label: new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
            month: "short",
            year: "2-digit",
            timeZone: "Africa/Cairo",
          }).format(date),
          income: Number(row?.income || 0),
          expense: Number(row?.expense || 0),
        };
      }),
    [months, d.operations.cashflow],
  );
  const maximum = Math.max(1, ...series.flatMap((x) => [x.income, x.expense])),
    totalIncome = series.reduce((s, r) => s + r.income, 0),
    totalExpense = series.reduce((s, r) => s + r.expense, 0);
  const streetDistrict = new Map(d.streets.map((street) => [street.id, street.district_id]));
  const districts = d.districts.map((x) => ({
    name: x.name,
    total: d.assets.filter((a) => streetDistrict.get(a.street_id) === x.id && a.live_status !== "retired").length,
    leased: d.assets.filter(
      (a) =>
        streetDistrict.get(a.street_id) === x.id &&
        ["leased", "expiring"].includes(a.live_status),
    ).length,
  }));
  const roleFinance = ["admin", "accounts", "accountant"].includes(
    d.profile.role,
  );
  const overdue = d.finance.filter(
    (f) =>
      f.direction === "receivable" &&
      Number(f.amount) > Number(f.paid) &&
      new Date(f.due_date + "T23:59:59Z") < new Date(),
  );
  return (
    <div className="analytics-area">
      <div className="analytics-toolbar">
        <div>
          <h2>{full ? "تقارير الأعمال والأداء" : "أداء أعمالك بالأرقام"}</h2>
          <p>التدفق النقدي الفعلي مستقل عن قيمة الإيجار التعاقدي.</p>
        </div>
        <div className="inline-actions">
          <select
            aria-label="الفترة الزمنية للتقرير"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          >
            <option value="3">آخر 3 أشهر</option>
            <option value="6">آخر 6 أشهر</option>
            <option value="12">آخر 12 شهرًا</option>
          </select>
          {full && (
            <button
              className="button secondary"
              onClick={() =>
                exportCsv(
                  "mesk-cashflow",
                  ["الشهر", "المحصل الفعلي", "المدفوع الفعلي", "الصافي"],
                  series.map((r) => [
                    r.key,
                    r.income,
                    r.expense,
                    r.income - r.expense,
                  ]),
                )
              }
            >
              <ArrowDownToLine size={16} />
              تصدير
            </button>
          )}
        </div>
      </div>
      {roleFinance && (
        <div className="ops-metrics">
          <Mini label="المحصل خلال الفترة" value={egp(totalIncome)} />
          <Mini label="المدفوع خلال الفترة" value={egp(totalExpense)} />
          <Mini
            label="صافي التدفق النقدي"
            value={egp(totalIncome - totalExpense)}
          />
          <Mini
            label="المتأخر على المعلنين"
            value={egp(
              overdue.reduce(
                (s, r) => s + Number(r.amount) - Number(r.paid),
                0,
              ),
            )}
          />
        </div>
      )}
      <div className="analytics-grid">
        {roleFinance && (
          <Panel
            title="المقبوضات والمدفوعات"
            subtitle="من حركات الخزائن والبنوك؛ التحويلات والأرصدة الافتتاحية مستبعدة"
          >
            <div
              className="bar-chart"
              role="img"
              aria-label="مقارنة المقبوضات والمدفوعات الشهرية"
            >
              <div className="chart-grid-lines">
                <span>{fmt(maximum)}</span>
                <span>{fmt(maximum / 2)}</span>
                <span>0</span>
              </div>
              <div className="bar-columns">
                {series.map((r, i) => (
                  <div
                    className="bar-column"
                    key={r.key}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <div className="bar-pair">
                      <button
                        aria-label={`${r.label}: مقبوضات ${egp(r.income)}`}
                        style={{ height: `${(r.income / maximum) * 100}%` }}
                        className="bar income"
                        onFocus={() => setHover(i)}
                        onBlur={() => setHover(null)}
                      />
                      <button
                        aria-label={`${r.label}: مدفوعات ${egp(r.expense)}`}
                        style={{ height: `${(r.expense / maximum) * 100}%` }}
                        className="bar expense"
                        onFocus={() => setHover(i)}
                        onBlur={() => setHover(null)}
                      />
                    </div>
                    <small>{r.label}</small>
                    {hover === i && (
                      <div className="chart-tip">
                        {r.label}
                        <br />
                        مقبوضات {egp(r.income)}
                        <br />
                        مدفوعات {egp(r.expense)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="map-legend">
              <span>
                <i className="dot green" />
                المقبوضات
              </span>
              <span>
                <i className="dot gold" />
                المدفوعات
              </span>
            </div>
            {totalIncome === 0 && totalExpense === 0 && (
              <p className="table-note">
                لم تُسجل حركات نقدية في الفترة المختارة.
              </p>
            )}
          </Panel>
        )}
        <Panel
          title="الإشغال حسب المناطق"
          subtitle="حالة الأصول الحالية ضمن نطاق صلاحياتك"
        >
          <div className="district-bars">
            {districts.map((r) => (
              <div key={r.name}>
                <div>
                  <strong>{r.name}</strong>
                  <span>
                    {fmt(r.leased)} / {fmt(r.total)} أصل
                  </span>
                </div>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${r.total ? (r.leased / r.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {!districts.length && (
              <p className="subtle">أضف المناطق والأصول لعرض التوزيع.</p>
            )}
          </div>
          <div className="analytics-ops">
            <span>
              أوامر عمل مفتوحة{" "}
              <b>
                {fmt(
                  d.operations.workOrders.filter(
                    (w) => !["completed", "cancelled"].includes(w.status),
                  ).length,
                )}
              </b>
            </span>
            <span>
              أصناف عند حد إعادة الطلب{" "}
              <b>
                {fmt(
                  d.operations.stockBalances.filter((s) => s.low_stock).length,
                )}
              </b>
            </span>
            <span>
              طلبات موقع جديدة{" "}
              <b>
                {fmt(
                  d.operations.enquiries.filter((l) => l.status === "new")
                    .length,
                )}
              </b>
            </span>
          </div>
        </Panel>
      </div>
      {full && (
        <>
          <Panel
            title="استحقاقات التحصيل"
            subtitle="المتبقي الفعلي على فواتير المعلنين حسب عمر التأخير"
          >
            <GridTable
              columns={["الفئة", "عدد الفواتير", "الرصيد"]}
              rows={[
                [0, 30],
                [31, 60],
                [61, Infinity],
              ].map(([min, max]) => {
                const rows = overdue.filter((r) => {
                  const days = Math.floor(
                    (Date.now() -
                      new Date(r.due_date + "T00:00:00Z").getTime()) /
                      86400000,
                  );
                  return days >= min && days <= max;
                });
                return [
                  max === Infinity ? "أكثر من 60 يومًا" : `${min}–${max} يومًا`,
                  fmt(rows.length),
                  egp(
                    rows.reduce(
                      (s, r) => s + Number(r.amount) - Number(r.paid),
                      0,
                    ),
                  ),
                ];
              })}
            />
          </Panel>
          <Panel
            title="ميزان المراجعة"
            subtitle="إجمالي القيود المرحلة؛ يجب أن يتساوى المدين والدائن"
          >
            <GridTable
              columns={["الكود", "الحساب", "مدين", "دائن", "الرصيد"]}
              rows={d.operations.trialBalance.map((a) => [
                a.code,
                a.name,
                egp(a.debit),
                egp(a.credit),
                egp(a.balance),
              ])}
            />
            <div className="report-total">
              <span>
                إجمالي المدين{" "}
                <b>
                  {egp(
                    d.operations.trialBalance.reduce(
                      (s, a) => s + Number(a.debit),
                      0,
                    ),
                  )}
                </b>
              </span>
              <span>
                إجمالي الدائن{" "}
                <b>
                  {egp(
                    d.operations.trialBalance.reduce(
                      (s, a) => s + Number(a.credit),
                      0,
                    ),
                  )}
                </b>
              </span>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
