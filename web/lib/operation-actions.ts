import "server-only";
import type { requireContext } from "./data";
type Context = Awaited<ReturnType<typeof requireContext>>;
export const operationModules: Record<string, string> = {
  employee: "employees",
  warehouse: "inventory",
  item: "inventory",
  stock: "inventory",
  purchase: "purchases",
  purchase_receive: "purchases",
  purchase_invoice: "finance",
  work_order: "maintenance",
  work_progress: "maintenance",
  inspection: "inspections",
  asset_tag: "assets",
  attendance_clock: "attendance",
  attendance_manual: "attendance",
  leave: "attendance",
  leave_decision: "attendance",
  payroll: "payroll",
  payroll_settle: "payroll",
  cash: "cashbook",
  cash_account: "cashbook",
  ledger_account: "cashbook",
  enquiry_update: "leads",
  reminders_queue: "whatsapp",
  contract_cancel: "customer_contracts",
  asset_update: "assets",
};
Object.assign(operationModules, {
  adjustment: "cashbook",
  installment: "finance",
  installment_issue: "finance",
});
export async function operationMutation(
  kind: string,
  form: FormData,
  { db, brand, user }: Context,
) {
  const s = (k: string) => String(form.get(k) || "").trim(),
    n = (k: string) => {
      const value = Number(s(k));
      if (!Number.isFinite(value)) throw new Error("INVALID_NUMBER");
      return value;
    },
    opt = (k: string) => s(k) || null;
  switch (kind) {
    case "adjustment": {
      const lines = JSON.parse(s("journal_lines") || "[]");
      return db.rpc("create_adjustment_journal", {
        p_ref: s("ref_no"),
        p_date: s("entry_date"),
        p_description: s("description"),
        p_lines: lines,
      });
    }
    case "installment":
      return db.rpc("schedule_installment", {
        p_customer_contract: opt("customer_contract_id"),
        p_upstream_contract: opt("upstream_contract_id"),
        p_party: s("party_id"),
        p_ref: s("ref_no"),
        p_due: s("due_date"),
        p_amount: n("amount"),
      });
    case "installment_issue":
      return db.rpc("issue_installment_invoice", { p_id: s("id") });
    case "employee": {
      const row = {
        tenant_id: brand.id,
        code: s("code"),
        full_name: s("full_name"),
        department: s("department"),
        job_title: s("job_title"),
        phone: opt("phone"),
        email: opt("email"),
        profile_id: opt("profile_id"),
        district_id: opt("district_id"),
        hire_date: s("hire_date"),
        base_salary: n("base_salary"),
        status: s("status") || "active",
      };
      return s("id")
        ? db
            .from("employees")
            .update(row)
            .eq("tenant_id", brand.id)
            .eq("id", s("id"))
            .select("id")
            .single()
        : db.from("employees").insert(row);
    }
    case "warehouse":
      return db
        .from("warehouses")
        .insert({
          tenant_id: brand.id,
          code: s("code"),
          name: s("name"),
          district_id: s("district_id"),
          address: opt("address"),
        });
    case "item":
      return db
        .from("inventory_items")
        .insert({
          tenant_id: brand.id,
          sku: s("sku"),
          name: s("name"),
          unit: s("unit"),
          reorder_level: n("reorder_level"),
        });
    case "stock":
      return db.rpc("move_stock", {
        p_kind: s("movement_kind"),
        p_ref: s("ref_no"),
        p_item: s("item_id"),
        p_from: opt("from_warehouse_id"),
        p_to: opt("to_warehouse_id"),
        p_quantity: n("quantity"),
        p_cost: n("unit_cost"),
        p_notes: s("notes"),
        p_asset: opt("asset_id"),
        p_work: opt("work_order_id"),
        p_return: opt("return_of"),
      });
    case "purchase": {
      const lines = JSON.parse(s("lines") || "[]");
      if (!Array.isArray(lines) || !lines.length || lines.length > 200)
        throw new Error("INVALID_LINES");
      return db.rpc("create_purchase", {
        p_ref: s("ref_no"),
        p_supplier: s("supplier_id"),
        p_warehouse: s("warehouse_id"),
        p_date: s("ordered_on"),
        p_expected: opt("expected_on"),
        p_lines: lines,
        p_notes: s("notes"),
      });
    }
    case "purchase_receive":
      return db.rpc("receive_purchase", { p_id: s("id") });
    case "purchase_invoice":
      return db.rpc("invoice_purchase", {
        p_id: s("id"),
        p_ref: s("ref_no"),
        p_due: s("due_date"),
      });
    case "work_order":
      return db
        .from("work_orders")
        .insert({
          tenant_id: brand.id,
          ref_no: s("ref_no"),
          asset_id: s("asset_id"),
          title: s("title"),
          description: opt("description"),
          assigned_employee_id: opt("assigned_employee_id"),
          priority: s("priority"),
          status: opt("assigned_employee_id") ? "assigned" : "open",
          due_date: s("due_date"),
          created_by: user.id,
        });
    case "work_progress":
      return db.rpc("progress_work_order", {
        p_id: s("id"),
        p_status: s("status"),
        p_resolution: s("resolution"),
      });
    case "inspection":
      return db.rpc("record_inspection", {
        p_asset: s("asset_id"),
        p_condition: s("condition"),
        p_method: s("method"),
        p_tag: opt("tag_uid"),
        p_notes: s("notes"),
        p_lat: opt("latitude") ? n("latitude") : null,
        p_lng: opt("longitude") ? n("longitude") : null,
      });
    case "asset_tag":
      return db
        .from("asset_tags")
        .insert({
          tenant_id: brand.id,
          asset_id: s("asset_id"),
          kind: s("tag_kind"),
          uid: s("uid"),
        });
    case "attendance_clock":
      return db.rpc("clock_attendance", {
        p_employee: s("employee_id"),
        p_action: s("clock_action"),
      });
    case "attendance_manual":
      return db.rpc("manual_attendance", {
        p_employee: s("employee_id"),
        p_day: s("work_date"),
        p_in: s("check_in"),
        p_out: s("check_out"),
        p_reason: s("notes"),
      });
    case "leave":
      return db.rpc("request_leave", {
        p_employee: s("employee_id"),
        p_start: s("start_date"),
        p_end: s("end_date"),
        p_kind: s("leave_kind"),
        p_reason: s("reason"),
      });
    case "leave_decision":
      return db.rpc("decide_leave", {
        p_id: s("id"),
        p_approve: s("decision") === "approve",
        p_note: s("notes"),
      });
    case "payroll":
      return db
        .from("payroll_items")
        .insert({
          tenant_id: brand.id,
          employee_id: s("employee_id"),
          period: s("period") + "-01",
          base_amount: n("base_amount"),
          bonus: n("bonus"),
          deductions: n("deductions"),
          notes: opt("notes"),
        });
    case "payroll_settle":
      return db.rpc("settle_payroll", {
        p_id: s("id"),
        p_action: s("payroll_action"),
        p_cash: opt("cash_account_id"),
        p_date: s("paid_on") || new Date().toISOString().slice(0, 10),
      });
    case "cash":
      return db.rpc("create_cash_transaction", {
        p_kind: s("cash_kind"),
        p_ref: s("ref_no"),
        p_cash: s("cash_account_id"),
        p_target: opt("target_cash_account_id"),
        p_category: opt("category_account_id"),
        p_amount: n("amount"),
        p_date: s("transaction_date"),
        p_description: s("description"),
        p_asset: opt("asset_id"),
        p_work: opt("work_order_id"),
      });
    case "ledger_account":
      return db.rpc("create_ledger_account", {
        p_code: s("code"),
        p_name: s("name"),
        p_kind: s("account_kind"),
      });
    case "cash_account":
      return db.rpc("create_cash_account", {
        p_code: s("code"),
        p_name: s("name"),
        p_kind: s("account_kind"),
      });
    case "enquiry_update":
      return db.rpc("update_enquiry", {
        p_id: s("id"),
        p_status: s("status"),
        p_notes: s("notes"),
      });
    case "reminders_queue":
      return db.rpc("queue_tenant_reminders");
    case "contract_cancel":
      return db.rpc("cancel_customer_contract", {
        p_id: s("id"),
        p_reason: s("reason"),
      });
    case "asset_update":
      return db
        .from("assets")
        .update({
          status: s("status"),
          notes: opt("notes"),
          public_visible: form.get("public_visible") === "on",
          cost: s("cost") ? n("cost") : null,
          install_date: opt("install_date"),
          useful_life_months: s("useful_life_months") ? n("useful_life_months") : null,
        })
        .eq("id", s("id"))
        .eq("tenant_id", brand.id)
        .select("id")
        .single();
    default:
      throw new Error("UNKNOWN_ACTION");
  }
}
