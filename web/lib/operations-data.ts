import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyOperations, type OperationsData } from "./operations-types";
// Page every collection to avoid silently truncating the Data API's default 1,000 row response.
export async function readTenantRows<T = Record<string, unknown>>(
  db: SupabaseClient,
  table: string,
  tenant: string,
  columns = "*",
  order = "id",
) {
  const output: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .eq("tenant_id", tenant)
      .order(order)
      .range(offset, offset + 499);
    if (error) throw new Error(`تعذر تحميل ${table}: ${error.message}`);
    output.push(...((data || []) as unknown as T[]));
    if (!data || data.length < 500) break;
    if (output.length >= 20000)
      throw new Error("حجم البيانات يتطلب تضييق فترة التقرير.");
  }
  return output;
}
export async function loadOperations(
  db: SupabaseClient,
  tenant: string,
): Promise<OperationsData> {
  const mapping: Record<string, string> = {
    employees: "employees",
    upstreamCoverage: "upstream_contract_assets",
    payments: "payments",
    attendance: "attendance",
    leaves: "leave_requests",
    warehouses: "warehouses",
    items: "inventory_items",
    stockBalances: "v_stock_balances",
    stockMoves: "stock_movements",
    purchases: "purchase_orders",
    purchaseLines: "purchase_lines",
    workOrders: "work_orders",
    inspections: "inspections",
    payroll: "payroll_items",
    accounts: "ledger_accounts",
    cashAccounts: "v_cash_balances",
    cashTransactions: "cash_transactions",
    journals: "journal_entries",
    journalLines: "journal_lines",
    trialBalance: "v_trial_balance",
    cashflow: "v_monthly_cashflow",
    enquiries: "enquiries",
    audit: "audit_events",
    reminders: "whatsapp_outbox",
    assetTags: "asset_tags",
  };
  mapping.installments = "contract_installments";
  mapping.contractLines = "contract_lines";
  const entries = await Promise.all(
    Object.entries(mapping).map(async ([key, table]) => {
      const order =
        key === "stockBalances"
          ? "item_id"
          : key === "cashflow"
            ? "month"
            : "id";
      return [
        key,
        await readTenantRows(db, table, tenant, "*", order),
      ] as const;
    }),
  );
  const pricing = await db.from("pricing_rules").select("id").eq("tenant_id", tenant).limit(0);
  if (pricing.error && !["PGRST205", "42P01"].includes(pricing.error.code)) throw new Error(pricing.error.message);
  const [directory, users] = await Promise.all([
    db.rpc("employee_directory"),
    db.rpc("tenant_user_directory"),
  ]);
  if (directory.error || users.error)
    throw new Error(directory.error?.message || users.error?.message);
  return {
    ...emptyOperations,
    ...Object.fromEntries(entries),
    pricingRules: pricing.error ? [] : await readTenantRows<OperationsData["pricingRules"][number]>(db,"pricing_rules",tenant),
    employeeDirectory: directory.data || [],
    tenantUsers: users.data || [],
  } as OperationsData;
}
