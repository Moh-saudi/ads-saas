"use client";
import { useState } from "react";
import type { WorkspaceData } from "@/lib/types";
import { DataForm } from "./forms";
import {
  Panel,
  GridTable,
  Dialog,
  Add,
  Field,
  Pick,
  Note,
  egp,
  date,
  State,
} from "./ops-ui";
export function ContractOperations({
  data: d,
  upstream = false,
}: {
  data: WorkspaceData;
  upstream?: boolean;
}) {
  const [modal, setModal] = useState<{ kind: string; id?: string } | null>(
      null,
    ),
    [contract, setContract] = useState("");
  const finance = ["admin", "accounts", "accountant"].includes(d.profile.role),
    sales = ["admin", "area_manager", "accounts"].includes(d.profile.role);
  const schedules = d.operations.installments.filter((i) =>
    upstream ? i.upstream_contract_id : !!i.customer_contract_id,
  );
  const detail = d.contracts.find((c) => c.id === modal?.id);
  return (
    <>
      <Panel
        title={
          upstream ? "جدول مستحقات العقود الصاعدة" : "جدول دفعات عقود المعلنين"
        }
        subtitle="تُدخل المبالغ والمواعيد المعتمدة صراحةً؛ فوترة القسط لا تعني تحصيله"
        action={
          finance && (
            <Add onClick={() => setModal({ kind: "installment" })}>
              إضافة قسط
            </Add>
          )
        }
      >
        <GridTable
          columns={[
            "المرجع",
            "العقد",
            "الطرف",
            "الاستحقاق",
            "القيمة",
            "الفوترة",
            "",
          ]}
          rows={schedules.map((i) => [
            i.ref_no,
            upstream
              ? d.upstream.find((u) => u.id === i.upstream_contract_id)?.ref_no
              : d.contracts.find((c) => c.id === i.customer_contract_id)
                  ?.ref_no,
            d.parties.find((p) => p.id === i.party_id)?.name,
            date(i.due_date),
            egp(i.amount),
            i.invoice_id ? "تمت الفوترة" : "لم يُفوتر",
            !i.invoice_id && finance ? (
              <button
                className="text-button"
                onClick={() =>
                  setModal({ kind: "installment_issue", id: i.id })
                }
              >
                إصدار فاتورة القسط
              </button>
            ) : null,
          ])}
        />
      </Panel>
      {!upstream && (
        <Panel
          title="تفاصيل البنود وإدارة العقود"
          subtitle="إلغاء العقد يحرر حجوزاته، ويُسجل السبب. الفواتير السابقة تبقى كسجل مالي مستقل"
        >
          <GridTable
            columns={["العقد", "الحالة", "البنود", ""]}
            rows={d.contracts.map((c) => [
              c.ref_no,
              <State key="s" value={c.status} />,
              d.operations.contractLines.filter((l) => l.contract_id === c.id)
                .length,
              <span key="a" className="row-actions">
                <button
                  className="text-button"
                  onClick={() => setModal({ kind: "detail", id: c.id })}
                >
                  البنود
                </button>
                {sales && c.status === "active" && (
                  <button
                    className="text-button"
                    onClick={() =>
                      setModal({ kind: "contract_cancel", id: c.id })
                    }
                  >
                    إلغاء بسبب مسجل
                  </button>
                )}
              </span>,
            ])}
          />
        </Panel>
      )}
      {modal && (
        <Dialog
          title={
            modal.kind === "detail"
              ? "بنود العقد"
              : modal.kind === "contract_cancel"
                ? "إلغاء عقد المعلن"
                : "جدولة وفوترة الدفعات"
          }
          onClose={() => setModal(null)}
        >
          {modal.kind === "detail" ? (
            <>
              <h3>{detail?.ref_no}</h3>
              <GridTable
                columns={[
                  "الأصل",
                  "البداية",
                  "النهاية",
                  "الإيجار الشهري",
                  "الحالة",
                ]}
                rows={d.operations.contractLines
                  .filter((l) => l.contract_id === modal.id)
                  .map((l) => [
                    d.assets.find((a) => a.id === l.asset_id)?.code,
                    date(l.start_date),
                    date(l.end_date),
                    egp(l.monthly_price),
                    <State key="s" value={l.status} />,
                  ])}
              />
            </>
          ) : (
            <DataForm
              kind={modal.kind}
              demo={d.demo}
              label={
                modal.kind === "contract_cancel"
                  ? "تأكيد إلغاء العقد"
                  : modal.kind === "installment_issue"
                    ? "إصدار الفاتورة"
                    : "حفظ القسط"
              }
            >
              {modal.id && <input type="hidden" name="id" value={modal.id} />}{" "}
              {modal.kind === "contract_cancel" ? (
                <>
                  <div className="notice">
                    سيُلغى العقد {detail?.ref_no} وبنوده وتتحرر حجوزاته. لن
                    تُحذف الفواتير والمدفوعات السابقة.
                  </div>
                  <Note name="reason" label="سبب الإلغاء" required />
                </>
              ) : modal.kind === "installment_issue" ? (
                <div className="notice">
                  سيُنشأ مستند فاتورة بالقيمة والجهة والموعد المسجل في القسط، مع
                  قيد محاسبي متوازن. لا يمكن فوترة القسط نفسه مرتين.
                </div>
              ) : (
                <>
                  <label>
                    العقد
                    <select
                      required
                      name={
                        upstream
                          ? "upstream_contract_id"
                          : "customer_contract_id"
                      }
                      value={contract}
                      onChange={(e) => setContract(e.target.value)}
                    >
                      <option value="">اختر…</option>
                      {(upstream ? d.upstream : d.contracts).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.ref_no}
                        </option>
                      ))}
                    </select>
                  </label>
                  {upstream ? (
                    <Pick
                      name="party_id"
                      label="الطرف المستحق (الوطنية)"
                      options={d.parties.filter((p) =>
                        ["master_concessionaire", "authority"].includes(p.type),
                      )}
                    />
                  ) : (
                    <>
                      <input
                        type="hidden"
                        name="party_id"
                        value={
                          d.contracts.find((c) => c.id === contract)
                            ?.customer_id || ""
                        }
                      />
                      <div className="notice">
                        المعلن:{" "}
                        {d.parties.find(
                          (p) =>
                            p.id ===
                            d.contracts.find((c) => c.id === contract)
                              ?.customer_id,
                        )?.name || "اختر العقد"}
                      </div>
                    </>
                  )}
                  <Field name="ref_no" label="مرجع القسط / الفاتورة" />
                  <Field name="due_date" label="تاريخ الاستحقاق" type="date" />
                  <Field
                    name="amount"
                    label="قيمة الدفعة"
                    type="number"
                    min="0.01"
                  />
                </>
              )}
            </DataForm>
          )}
        </Dialog>
      )}
    </>
  );
}
