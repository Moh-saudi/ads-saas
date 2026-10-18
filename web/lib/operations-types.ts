export type Employee = {
  id: string;
  code: string;
  full_name: string;
  department: string;
  job_title: string;
  district_id: string | null;
  status: string;
  profile_id?: string | null;
  phone?: string | null;
  email?: string | null;
  hire_date?: string;
  base_salary?: number;
};
export type Attendance = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in: string;
  check_out: string | null;
  notes: string | null;
};
export type Leave = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  kind: string;
  reason: string;
  status: string;
  decision_note: string | null;
};
export type Warehouse = {
  id: string;
  code: string;
  name: string;
  district_id: string;
  address: string | null;
  active: boolean;
};
export type Item = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  reorder_level: number;
  active: boolean;
};
export type StockBalance = {
  item_id: string;
  warehouse_id: string;
  item_name: string;
  warehouse_name: string;
  sku: string;
  unit: string;
  quantity: number;
  inventory_value: number;
  average_cost: number;
  reorder_level: number;
  low_stock: boolean;
};
export type StockMove = {
  id: string;
  ref_no: string;
  item_id: string;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  quantity: number;
  unit_cost: number;
  kind: string;
  asset_id: string | null;
  work_order_id: string | null;
  notes: string;
  created_at: string;
  return_of: string | null;
};
export type Purchase = {
  id: string;
  ref_no: string;
  supplier_id: string;
  warehouse_id: string;
  ordered_on: string;
  expected_on: string | null;
  status: string;
  notes: string | null;
};
export type PurchaseLine = {
  id: string;
  purchase_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
};
export type WorkOrder = {
  id: string;
  ref_no: string;
  asset_id: string;
  title: string;
  description: string | null;
  assigned_employee_id: string | null;
  priority: string;
  status: string;
  due_date: string;
  completed_at: string | null;
  resolution: string | null;
};
export type Inspection = {
  id: string;
  asset_id: string;
  condition: string;
  method: string;
  tag_uid: string | null;
  notes: string;
  checked_at: string;
  inspector_id: string;
};
export type Payroll = {
  id: string;
  employee_id: string;
  period: string;
  base_amount: number;
  bonus: number;
  deductions: number;
  net_amount: number;
  status: string;
  notes: string | null;
  paid_on: string | null;
};
export type Account = {
  id: string;
  code: string;
  name: string;
  kind: string;
  active: boolean;
};
export type CashAccount = {
  id: string;
  name: string;
  kind: string;
  balance: number;
  ledger_account_id: string;
  allow_overdraft: boolean;
};
export type CashTransaction = {
  id: string;
  ref_no: string;
  cash_account_id: string;
  target_cash_account_id: string | null;
  kind: string;
  category_account_id: string | null;
  amount: number;
  transaction_date: string;
  description: string;
  asset_id: string | null;
  work_order_id: string | null;
};
export type Journal = {
  id: string;
  ref_no: string;
  entry_date: string;
  description: string;
  source_kind: string;
};
export type JournalLine = {
  id: string;
  entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
};
export type TrialBalance = {
  id: string;
  code: string;
  name: string;
  kind: string;
  debit: number;
  credit: number;
  balance: number;
};
export type CashflowMonth = { month: string; income: number; expense: number };
export type Enquiry = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  message: string;
  asset_code: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};
export type Audit = {
  id: string;
  actor_id: string | null;
  table_name: string;
  record_id: string | null;
  operation: string;
  created_at: string;
  changes: Record<string, unknown>;
};
export type Reminder = {
  id: string;
  contract_id: string;
  party_id: string;
  days_before: number;
  renewal_date: string;
  status: string;
  provider_message_id: string | null;
  last_error: string | null;
  created_at: string;
};
export type AssetTag = {
  id: string;
  asset_id: string;
  kind: string;
  uid: string;
  active: boolean;
};
export type Installment = {
  id: string;
  customer_contract_id: string | null;
  upstream_contract_id: string | null;
  party_id: string;
  ref_no: string;
  due_date: string;
  amount: number;
  invoice_id: string | null;
};
export type ContractLine = {
  id: string;
  contract_id: string;
  asset_id: string;
  start_date: string;
  end_date: string;
  monthly_price: number;
  status: string;
};
export type OperationsData = {
  tenantUsers: { id: string; full_name: string; role: string }[];
  installments: Installment[];
  contractLines: ContractLine[];
  employees: Employee[];
  employeeDirectory: Employee[];
  attendance: Attendance[];
  leaves: Leave[];
  warehouses: Warehouse[];
  items: Item[];
  stockBalances: StockBalance[];
  stockMoves: StockMove[];
  purchases: Purchase[];
  purchaseLines: PurchaseLine[];
  workOrders: WorkOrder[];
  inspections: Inspection[];
  payroll: Payroll[];
  accounts: Account[];
  cashAccounts: CashAccount[];
  cashTransactions: CashTransaction[];
  journals: Journal[];
  journalLines: JournalLine[];
  trialBalance: TrialBalance[];
  cashflow: CashflowMonth[];
  enquiries: Enquiry[];
  audit: Audit[];
  reminders: Reminder[];
  assetTags: AssetTag[];
};
export const emptyOperations: OperationsData = {
  tenantUsers: [],
  installments: [],
  contractLines: [],
  employees: [],
  employeeDirectory: [],
  attendance: [],
  leaves: [],
  warehouses: [],
  items: [],
  stockBalances: [],
  stockMoves: [],
  purchases: [],
  purchaseLines: [],
  workOrders: [],
  inspections: [],
  payroll: [],
  accounts: [],
  cashAccounts: [],
  cashTransactions: [],
  journals: [],
  journalLines: [],
  trialBalance: [],
  cashflow: [],
  enquiries: [],
  audit: [],
  reminders: [],
  assetTags: [],
};
export const operationSections = [
  "employees",
  "attendance",
  "payroll",
  "inventory",
  "purchases",
  "maintenance",
  "inspections",
  "cashbook",
  "reports",
  "whatsapp",
  "leads",
  "audit",
] as const;
export const allSections = [
  "guide",
  "dashboard",
  "assets",
  "contracts",
  "upstream",
  "customers",
  "geography",
  "finance",
  "licenses",
  "conflicts",
  "settings",
  ...operationSections,
];
