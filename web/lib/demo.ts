import { type Brand, type WorkspaceData } from "./types";
import { operationsDemo } from "./operations-demo";
import { operationSections } from "./operations-types";
export const demoBrand: Brand = {
  id: "demo",
  name: "مدار للإعلان",
  slug: "madar",
  logo_url: null,
  primary_color: "#0b1f4d",
  contact_phone: "+201000000000",
  contact_email: "hello@example.com",
  whatsapp: null,
  address: "القاهرة الجديدة، مصر",
  website_title: "مساحة يراها الجميع.",
  website_description:
    "حلول إعلانية خارجية في مواقع مختارة. اكتشف المساحة المناسبة لحملتك وتواصل مع فريقنا.",
  public_site_enabled: true,
};
// All records and totals below are fixtures for /demo only. They never enter the live database.
export function demoData(): WorkspaceData {
  const today = new Date();
  const date = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const streets = [
    {
      id: "s1",
      name: "شارع التسعين الشمالي",
      district_id: "d1",
      holding: "full",
    },
    { id: "s2", name: "محور محمد نجيب", district_id: "d1", holding: "partial" },
    { id: "s3", name: "طريق السويس", district_id: "d2", holding: "partial" },
  ];
  const assets = Array.from({ length: 18 }, (_, i) => ({
    id: `a${i}`,
    code: `MD-${String(i + 101).padStart(4, "0")}`,
    street_id: streets[i % 3].id,
    street_name: streets[i % 3].name,
    district_name: i % 3 === 2 ? "مدينة الشروق" : "التجمع الخامس",
    type_id: i % 3 === 0 ? "t2" : "t1",
    type_name: i % 3 === 0 ? "لوحة طرق" : "عمود إعلاني",
    live_status:
      i < 3
        ? "vacant"
        : i === 3
          ? "maintenance"
          : i < 8
            ? "expiring"
            : "leased",
    lease_end: i < 4 ? null : date(i < 8 ? 20 + i : 100 + i),
    coverage_end: date(240),
    chain_conflict: false,
    monthly_price: i < 4 ? null : 4500 + i * 250,
    monthly_cost: 2200,
    latitude: (i % 3 === 2 ? 30.125 : i % 3 === 0 ? 30.031 : 30.006) + Math.floor(i / 3) * 0.003,
    longitude: (i % 3 === 2 ? 31.625 : i % 3 === 0 ? 31.488 : 31.478) + Math.floor(i / 3) * 0.004,
    length_m: i % 3 === 0 ? 6 : 2,
    width_m: i % 3 === 0 ? 3 : 1,
    faces: 2,
    material: "حديد مجلفن",
    notes: "موقع تقريبي للعرض التجريبي؛ لا يمثل تصريحًا أو موقع تركيب معتمدًا.",
    public_visible: true,
    status: i === 3 ? "maintenance" as const : "active" as const,
    cost: i % 3 === 0 ? 60000 : 18000,
    install_date: date(-180),
    useful_life_months: 60,
  }));
  const parties = [
    {
      id: "p1",
      name: "شركة آفاق للتطوير",
      type: "advertiser",
      phone: "01000000000",
      whatsapp: null,
      wa_opt_in: false,
      tax_no: null,
    },
    {
      id: "p2",
      name: "مجموعة النخبة",
      type: "advertiser",
      phone: "01100000000",
      whatsapp: null,
      wa_opt_in: false,
      tax_no: null,
    },
  ];
  const operations = operationsDemo();
  operations.contractLines = assets.filter(a => a.monthly_price != null).map((a, i) => ({
    id: `cl${i+1}`, contract_id: Number(a.id.slice(1)) < 8 ? "c1" : "c2",
    asset_id: a.id, start_date: date(-15), end_date: a.lease_end!,
    monthly_price: a.monthly_price!, status: "active",
  }));
  operations.upstreamCoverage = assets.map((a,i)=>({id:`cov${i}`,asset_id:a.id,upstream_contract_id:"u1",valid_from:date(-120),valid_to:date(240),monthly_cost:a.monthly_cost}));
  operations.pricingRules = [
    {id:"rate1",district_id:"d1",type_id:"t1",monthly_price:5000,valid_from:date(-365),valid_to:date(365)},
    {id:"rate2",district_id:"d1",type_id:"t2",monthly_price:12000,valid_from:date(-365),valid_to:date(365)},
    {id:"rate3",district_id:"d2",type_id:"t1",monthly_price:4500,valid_from:date(-365),valid_to:date(365)},
  ];
  operations.payments = operations.cashTransactions.filter(t=>t.ref_no.startsWith("RCPT-")).map((t,i)=>({id:`receipt-${i+1}`,invoice_id:"f1",amount:t.amount,paid_on:t.transaction_date,reference:t.ref_no,payment_method:t.payment_method||"unknown",cash_account_id:t.cash_account_id}));
  const authorityPayment=operations.cashTransactions.find(t=>t.kind==="payment"&&t.description.includes("PAY-001"));
  if(authorityPayment)operations.payments.push({id:"receipt-authority",invoice_id:"f2",amount:authorityPayment.amount,paid_on:authorityPayment.transaction_date,reference:authorityPayment.ref_no,payment_method:authorityPayment.payment_method||"unknown",cash_account_id:authorityPayment.cash_account_id});
  operations.purchases = operations.purchases.map(p=>({...p,asset_id:p.id==="po1"?"a0":"a8",work_order_id:p.id==="po1"?"w1":"w3",procurement_kind:p.id==="po1"?"external_manufacture":"purchase"}));
  operations.workOrders = operations.workOrders.map(w=>({...w,kind:w.id==="w3"?"installation":"maintenance",planned_start:w.id==="w3"?date(-4):date(0)}));
  operations.items = operations.items.map(i=>({...i,length_m:i.id==="it1"?2:null,width_m:i.id==="it1"?1:null,material:i.id==="it1"?"حديد مجلفن":null}));
  const contractTotal = (id: string) => operations.contractLines.filter(l => l.contract_id === id).reduce((sum,l) => sum + Math.round(l.monthly_price * ((Date.parse(l.end_date) - Date.parse(l.start_date)) / 86400000 + 1) / 30 * 100), 0) / 100;
  const revenue = assets.reduce((s, a) => s + (a.monthly_price || 0), 0),
    cost = assets.reduce((s, a) => s + a.monthly_cost, 0);
  return {
    operations,
    brand: demoBrand,
    profile: { full_name: "أحمد محمود", role: "admin" },
    demo: true,
    assets,
    kpis: {
      total_assets: 18,
      leased: 14,
      occupancy_pct: 77.8,
      monthly_revenue: revenue,
      monthly_cost: cost,
      net_margin: revenue - cost,
      expiring_soon: 4,
      chain_conflicts: assets.filter(a => a.chain_conflict).length,
    },
    parties: [
      ...parties,
      { id: "authority1", name: "جهاز المدينة — جهة تجريبية", type: "authority", phone: "01000000005", whatsapp: null, wa_opt_in: false, tax_no: null },
      { id: "master1", name: "شركة الامتياز الإعلاني — مثال", type: "master_concessionaire", phone: "01000000006", whatsapp: null, wa_opt_in: false, tax_no: null },
      {
        id: "supplier1",
        name: "المورد التجريبي للمعدات",
        type: "supplier",
        phone: "01000000004",
        whatsapp: null,
        wa_opt_in: false,
        tax_no: null,
      },
    ],
    contracts: [
      {
        id: "c1",
        ref_no: "ADV-2026-001",
        customer_id: "p1",
        start_date: date(-60),
        end_date: date(27),
        status: "active",
        total_value: contractTotal("c1"),
      },
      {
        id: "c2",
        ref_no: "ADV-2026-002",
        customer_id: "p2",
        start_date: date(-15),
        end_date: date(117),
        status: "active",
        total_value: contractTotal("c2"),
      },
    ],
    modules: [
      "dashboard",
      "customers",
      "geography",
      "assets",
      "upstream_contracts",
      "customer_contracts",
      "finance",
      "licenses",
      "whatsapp",
      ...operationSections,
    ].map((module_key) => ({ module_key, enabled: true })),
    streets,
    districts: [
      { id: "d1", name: "التجمع الخامس", governorate_id: "g1" },
      { id: "d2", name: "مدينة الشروق", governorate_id: "g1" },
    ],
    governorates: [{ id: "g1", name: "القاهرة" }],
    assetTypes: [
      { id: "t1", name: "عمود إعلاني" },
      { id: "t2", name: "لوحة طرق" },
    ],
    finance: [
      { id:"f3",ref_no:"INV-002",direction:"receivable",party_id:"p2",amount:19500,paid:0,due_date:date(-10),status:"open" },
      { id:"f4",ref_no:"SUP-001",direction:"payable",party_id:"supplier1",amount:8000,paid:0,due_date:date(15),status:"open" },
      {
        id: "f1",
        ref_no: "INV-001",
        direction: "receivable",
        party_id: "p1",
        amount: 27000,
        paid: 18000,
        due_date: date(7),
        status: "open",
      },
      {
        id: "f2",
        ref_no: "PAY-001",
        direction: "payable",
        party_id: "authority1",
        amount: 36000,
        paid: 36000,
        due_date: date(-2),
        status: "paid",
      },
    ],
    licenses: assets.map((a,i) => ({ id:`l${i+1}`, asset_id:a.id, ref_no:`LIC-${101+i}`, valid_from:date(-365), status:"active" as const, issuer:i%3===2?"جهة الشروق — مثال":"جهة القاهرة الجديدة — مثال", expires_on:date(i===0?30:240) })),
    upstream: [
      {
        id: "u1",
        ref_no: "NAT-2026-01",
        start_date: date(-120),
        end_date: date(240),
        billing_model: "lump_sum",
        annual_fee: 475200,
        status: "active",
      },
    ],
  };
}
