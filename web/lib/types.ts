import type { OperationsData } from "./operations-types";
export type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  contact_phone: string | null;
  contact_email: string | null;
  whatsapp: string | null;
  address: string | null;
  website_title: string | null;
  website_description: string | null;
  public_site_enabled: boolean;
};
export type Asset = {
  status?: "active" | "maintenance" | "retired";
  cost?: number | null;
  install_date?: string | null;
  useful_life_months?: number | null;
  id: string;
  code: string;
  street_id: string;
  street_name: string;
  district_name: string;
  type_name: string;
  live_status: string;
  lease_end: string | null;
  coverage_end: string | null;
  chain_conflict: boolean;
  monthly_price: number | null;
  monthly_cost: number | null;
  latitude: number | null;
  longitude: number | null;
  length_m: number | null;
  width_m: number | null;
  faces: number;
  material: string | null;
  notes: string | null;
  public_visible: boolean;
};
export type Party = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  whatsapp: string | null;
  wa_opt_in: boolean;
  tax_no: string | null;
};
export type Contract = {
  id: string;
  ref_no: string | null;
  customer_id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_value: number | null;
};
export type Kpis = {
  total_assets: number;
  leased: number;
  occupancy_pct: number;
  monthly_revenue: number;
  monthly_cost: number;
  net_margin: number;
  expiring_soon: number;
  chain_conflicts: number;
};
export type FinanceRow = {
  id: string;
  ref_no: string;
  direction: string;
  party_id: string;
  amount: number;
  paid: number;
  due_date: string;
  status: string;
};
export type License = {
  id: string;
  asset_id: string;
  ref_no: string;
  expires_on: string;
  issuer: string;
};
export type Upstream = {
  id: string;
  ref_no: string;
  start_date: string;
  end_date: string;
  billing_model: string;
  annual_fee: number;
  status: string;
};
export type WorkspaceData = {
  operations: OperationsData;
  brand: Brand;
  profile: { full_name: string; role: string };
  demo: boolean;
  assets: Asset[];
  kpis: Kpis;
  parties: Party[];
  contracts: Contract[];
  modules: { module_key: string; enabled: boolean }[];
  streets: { id: string; name: string; district_id: string; holding: string }[];
  districts: { id: string; name: string; governorate_id: string }[];
  governorates: { id: string; name: string }[];
  assetTypes: { id: string; name: string }[];
  finance: FinanceRow[];
  licenses: License[];
  upstream: Upstream[];
};
export const emptyKpis: Kpis = {
  total_assets: 0,
  leased: 0,
  occupancy_pct: 0,
  monthly_revenue: 0,
  monthly_cost: 0,
  net_margin: 0,
  expiring_soon: 0,
  chain_conflicts: 0,
};
export const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  area_manager: "مدير منطقة",
  accounts: "مسؤول حسابات",
  accountant: "محاسب",
  supervisor: "مشرف",
  inspector: "مفتش ميداني",
  storekeeper: "أمين مخزن",
  hr: "الموارد البشرية",
  viewer: "مشاهد",
};
export const statuses: Record<string, string> = {
  vacant: "متاح",
  leased: "مؤجَّر",
  expiring: "قارب الانتهاء",
  maintenance: "صيانة",
  active: "نشط",
  draft: "مسودة",
  expired: "منتهٍ",
  cancelled: "ملغى",
  paid: "مسدد",
  open: "قيد التحصيل",
  retired: "مستبعد",
};
