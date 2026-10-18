"use client";
import Link from "next/link";
import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  PanelsTopLeft,
  FileText,
  MapPin,
  Users,
  Wallet,
  ShieldCheck,
  Settings,
  ArrowUpRight,
  Plus,
  Search,
  ChevronLeft,
  Menu,
  X,
  LogOut,
  Bell,
  Building2,
  TriangleAlert,
  ArrowDownToLine,
  Map,
  LayoutGrid,
  Check,
  Phone,
  Mail,
  SlidersHorizontal,
  Layers,
  Globe,
  ExternalLink,
} from "lucide-react";
import { LocationCoverage } from "./location-coverage";
import { DataForm } from "./forms";
import type { MapPoint } from "./location-picker";
import { Operations, operationNavigation } from "./operations";
import { Analytics } from "./analytics";
import { ContractOperations } from "./contract-operations";
import { ItemizedInvoiceFields } from "./invoice-fields";
import { AssetRecord } from "./asset-record";
import { WebsiteEditor } from "./website-editor";
import { operationSections } from "@/lib/operations-types";
import { logout } from "@/app/actions";
import {
  type WorkspaceData,
  type Asset,
  roleLabels,
  statuses,
} from "@/lib/types";
const AssetMap = dynamic(() => import("./map").then((m) => m.AssetMap), {
  ssr: false,
  loading: () => <div className="asset-map skeleton">جارٍ تحميل الخريطة…</div>,
});
const LocationPicker = dynamic(() => import("./location-picker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <p className="notice">جارٍ تحميل خريطة اختيار الموقع…</p>,
});
const number = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    Number(n || 0),
  );
const money = (n: number | null | undefined) =>
  n == null ? "—" : `${number(n)} ج.م`;
const formatDate = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Cairo",
      }).format(new Date(`${v}T12:00:00Z`))
    : "—";
const navigation = [
  {
    id: "dashboard",
    label: "نظرة عامة",
    icon: LayoutDashboard,
    module: "dashboard",
  },
  {
    id: "assets",
    label: "الأصول والمواقع",
    icon: PanelsTopLeft,
    module: "assets",
  },
  {
    id: "contracts",
    label: "عقود المعلنين",
    icon: FileText,
    module: "customer_contracts",
  },
  {
    id: "upstream",
    label: "العقود الصاعدة",
    icon: Layers,
    module: "upstream_contracts",
  },
  {
    id: "customers",
    label: "العملاء والأطراف",
    icon: Users,
    module: "customers",
  },
  {
    id: "geography",
    label: "المناطق والشوارع",
    icon: MapPin,
    module: "geography",
  },
  {
    id: "finance",
    label: "الفواتير والتحصيل",
    icon: Wallet,
    module: "finance",
  },
  { id: "licenses", label: "التراخيص", icon: ShieldCheck, module: "licenses" },
  {
    id: "conflicts",
    label: "التعارضات والتنبيهات",
    icon: TriangleAlert,
    module: "dashboard",
  },
  {
    id: "settings",
    label: "هوية الشركة والإعدادات",
    icon: Settings,
    module: "settings",
  },
];
navigation.splice(navigation.length - 1, 0, ...operationNavigation);
export const sections = navigation.map((n) => n.id);
export function Workspace({
  data: d,
  section,
}: {
  data: WorkspaceData;
  section: string;
}) {
  const [menu, setMenu] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<Asset | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [mapView, setMapView] = useState(false);
  const base = d.demo ? "/demo" : "/app";
  const nav = navigation.find((n) => n.id === section) || navigation[0];
  const enabled = (key: string) =>
    key === "settings" ||
    d.modules.some((m) => m.module_key === key && m.enabled);
  const visibleNav = navigation.filter(
    (n) =>
      enabled(n.module) && (n.id !== "settings" || d.profile.role === "admin"),
  );
  const canAssets = ["admin", "area_manager", "supervisor"].includes(
      d.profile.role,
    ),
    canSales = ["admin", "area_manager", "accounts"].includes(d.profile.role),
    canFinance = ["admin", "accounts", "accountant"].includes(d.profile.role);
  const canCreate = (
    {
      assets: canAssets,
      contracts: canSales,
      customers: canSales,
      geography: ["admin", "area_manager"].includes(d.profile.role),
      finance: canFinance,
      licenses: canAssets,
      upstream: d.profile.role === "admin",
    } as Record<string, boolean>
  )[section];
  const filtered = useMemo(
    () =>
      d.assets.filter(
        (a) =>
          (status === "all" || a.live_status === status) &&
          `${a.code} ${a.street_name} ${a.district_name}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [d.assets, status, search],
  );
  const selectAsset = useCallback((a: Asset) => setSelected(a), []);
  const expiring = d.assets.filter((a) => a.live_status === "expiring"),
    conflicts = d.assets.filter((a) => a.chain_conflict);
  function download() {
    const rows = [
      ["الكود", "الشارع", "الحالة", "الإيراد الشهري", "التكلفة الشهرية"],
      ...filtered.map((a) => [
        a.code,
        a.street_name,
        statuses[a.live_status],
        a.monthly_price || 0,
        a.monthly_cost || 0,
      ]),
    ];
    const csv =
      "\ufeff" +
      rows
        .map((r) =>
          r
            .map(
              (c) =>
                `"${String(c)
                  .replace(/^[=+@\-]/, "'")
                  .replaceAll('"', '""')}"`,
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mesk-assets.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="workspace">
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="إغلاق القائمة"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link href={`${base}/dashboard`} className="brand-lockup">
          <div className="brand-mark">
            {d.brand.logo_url ? (
              <img src={d.brand.logo_url} alt={d.brand.name} />
            ) : (
              <PanelsTopLeft size={25} />
            )}
          </div>
          <div>
            <strong>{d.brand.name}</strong>
            <small>إدارة المساحات الإعلانية</small>
          </div>
        </Link>
        <div className="workspace-label">
          مساحة العمل <span>PRO</span>
        </div>
        <nav>
          {visibleNav.map((n) => (
            <Link
              onClick={() => {
                setMenu(false);
                setSearch("");
                setStatus("all");
              }}
              key={n.id}
              href={`${base}/${n.id}`}
              aria-current={section === n.id ? "page" : undefined}
              className={`nav-link ${section === n.id ? "active" : ""}`}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "conflicts" && conflicts.length > 0 && (
                <b className="nav-count">{conflicts.length}</b>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="tenant-isolation">
            <ShieldCheck size={18} />
            <span>
              مساحة مستقلة لشركتك<small>بيانات وصلاحيات خاصة</small>
            </span>
          </div>
          <a
            className="public-site-link"
            href={d.demo ? "/demo-site" : "/"}
            target="_blank"
            rel="noreferrer"
          >
            <Globe size={17} />
            زيارة موقع الشركة
            <ArrowUpRight size={16} />
          </a>
          <div className="powered">
            طُوّرت بواسطة{" "}
            <b>
              Mesk<span>®</span>
            </b>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-menu"
              aria-label="فتح القائمة"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>مساحة العمل</span>
            <ChevronLeft size={14} />
            <strong>{nav.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`connection ${d.demo ? "demo" : ""}`}>
              <i />
              {d.demo ? "بيئة تجريبية" : "مساحة العمل متصلة"}
            </span>
            <Link
              className="icon-button notification"
              href={`${base}/conflicts`}
              aria-label="التنبيهات"
            >
              <Bell size={20} />
              {expiring.length > 0 && <i />}
            </Link>
            <div className="profile">
              <span className="avatar">
                {d.profile.full_name?.slice(0, 1) || "م"}
              </span>
              <span>
                <b>{d.profile.full_name || "مستخدم"}</b>
                <small>{roleLabels[d.profile.role]}</small>
              </span>
            </div>
            {!d.demo && (
              <form action={logout}>
                <button className="icon-button" aria-label="تسجيل الخروج">
                  <LogOut size={17} />
                </button>
              </form>
            )}
          </div>
        </header>
        <main className="main-content">
          {d.demo && (
            <div className="demo-strip">
              <span>
                <span className="demo-dot" />
                معاينة المنصة · جميع الأسماء والأرقام بيانات تجريبية
              </span>
              <Link href="/setup">
                ربط شركتك بالمنصة <ChevronLeft size={14} />
              </Link>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {section === "dashboard"
                  ? "كل مساحاتك، في صورة واحدة"
                  : "منصة إدارة اللافتات الذكية"}
              </div>
              <h1>
                {section === "dashboard" ? "نظرة عامة على أعمالك" : nav.label}
              </h1>
              <p>
                {section === "dashboard"
                  ? "تابع إشغال مواقعك، وعقودك، وأداء أعمالك من مكان واحد."
                  : section === "settings"
                    ? "هوية تظهر لعملائك، وإعدادات تناسب فريقك."
                    : "بيانات شركتك ضمن نطاق الصلاحيات المخصص لك."}
              </p>
            </div>
            <div className="heading-actions">
              {section === "dashboard" ? (
                <span className="date-label">
                  {new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
                    dateStyle: "long",
                    timeZone: "Africa/Cairo",
                  }).format(new Date())}
                </span>
              ) : null}
              {section === "assets" && (
                <button className="button secondary" onClick={download}>
                  <ArrowDownToLine size={17} />
                  تصدير
                </button>
              )}
              {canCreate && (
                <button
                  className="button primary"
                  onClick={() =>
                    setModal(
                      section === "geography"
                        ? "street"
                        : section === "finance"
                          ? "invoice"
                          : section === "customers"
                            ? "party"
                            : section === "contracts"
                              ? "contract"
                              : section === "assets"
                                ? "asset"
                                : section === "licenses"
                                  ? "license"
                                  : "upstream",
                    )
                  }
                >
                  <Plus size={18} />{" "}
                  {section === "contracts"
                    ? "عقد جديد"
                    : section === "assets"
                      ? "إضافة أصل"
                      : section === "customers"
                        ? "إضافة طرف"
                        : section === "finance"
                          ? "فاتورة جديدة"
                          : section === "licenses"
                            ? "إضافة ترخيص"
                            : section === "upstream"
                              ? "عقد صاعد جديد"
                              : "إضافة شارع"}
                </button>
              )}
            </div>
          </div>
          {!enabled(nav.module) ? (
            <Empty text="هذه الوحدة غير مفعّلة. يمكن لمدير الشركة تفعيلها من الإعدادات." />
          ) : section === "settings" && d.profile.role !== "admin" ? (
            <Empty text="هذه الشاشة مخصصة لمدير النظام." />
          ) : (
            <>
              {(operationSections as readonly string[]).includes(section) && (
                <Operations key={section} data={d} section={section} />
              )}
              {section === "dashboard" && (
                <>
                  <div className="kpi-grid">
                    <Kpi
                      title="إجمالي الأصول"
                      value={number(d.kpis.total_assets)}
                      icon={<PanelsTopLeft size={21} />}
                      footer={`${number(d.kpis.leased)} أصلًا مؤجرًا`}
                      tone="navy"
                    />
                    <Kpi
                      title="نسبة الإشغال"
                      value={`${number(d.kpis.occupancy_pct)}%`}
                      icon={<LayoutGrid size={21} />}
                      footer={`${number(Number(d.kpis.total_assets) - Number(d.kpis.leased))} أصل غير مؤجر`}
                      tone="green"
                    />
                    <Kpi
                      title="الإيراد الشهري التعاقدي"
                      value={money(d.kpis.monthly_revenue)}
                      icon={<Wallet size={21} />}
                      footer="قيمة الإيجارات السارية حاليًا"
                      tone="gold"
                    />
                    <Kpi
                      title="صافي الهامش الشهري"
                      value={money(d.kpis.net_margin)}
                      icon={<ArrowUpRight size={21} />}
                      footer={`التكلفة ${money(d.kpis.monthly_cost)}`}
                      tone="green"
                    />
                  </div>
                  <LocationCoverage assets={d.assets} />
                  <Analytics data={d} />
                  <div className="dashboard-middle">
                    <section className="card map-card">
                      <CardHead
                        title="مواقعك على الخريطة"
                        sub="توزيع الأصول وحالة الإشغال"
                        action={
                          <Link href={`${base}/assets`}>
                            عرض الأصول <ChevronLeft size={15} />
                          </Link>
                        }
                      />
                      <AssetMap assets={d.assets.filter((a) => a.live_status !== "retired")} onSelect={selectAsset} />
                      <div className="map-legend">
                        <span>
                          <i className="dot navy" />
                          مؤجَّر
                        </span>
                        <span>
                          <i className="dot green" />
                          متاح
                        </span>
                        <span>
                          <i className="dot gold" />
                          قارب الانتهاء
                        </span>
                        <span>
                          <i className="dot red" />
                          صيانة
                        </span>
                      </div>
                    </section>
                    <section className="card occupancy-card">
                      <CardHead
                        title="حالة المحفظة"
                        sub="الإشغال الحالي للأصول"
                      />
                      <div
                        className="donut"
                        style={
                          {
                            "--pct": `${Number(d.kpis.occupancy_pct || 0) * 3.6}deg`,
                          } as CSSProperties
                        }
                      >
                        <div>
                          <strong>
                            {number(d.kpis.occupancy_pct)}
                            <span>%</span>
                          </strong>
                          <small>نسبة الإشغال</small>
                        </div>
                      </div>
                      <div className="occupancy-rows">
                        {[
                          ["مؤجَّر", d.kpis.leased, "navy"],
                          [
                            "متاح",
                            d.assets.filter((a) => a.live_status === "vacant")
                              .length,
                            "green",
                          ],
                          [
                            "صيانة",
                            d.assets.filter(
                              (a) => a.live_status === "maintenance",
                            ).length,
                            "red",
                          ],
                        ].map(([label, value, color]) => (
                          <div key={String(label)}>
                            <span>
                              <i className={`dot ${color}`} />
                              {label}
                            </span>
                            <b>{number(Number(value))}</b>
                          </div>
                        ))}
                      </div>
                      <div className="vacancy-cost">
                        تكلفة المواقع الشاغرة{" "}
                        <b>
                          {money(
                            d.assets
                              .filter((a) => a.live_status === "vacant")
                              .reduce(
                                (s, a) => s + Number(a.monthly_cost || 0),
                                0,
                              ),
                          )}
                        </b>
                      </div>
                    </section>
                  </div>
                  <div className="dashboard-bottom">
                    <section className="card">
                      <CardHead
                        title="عقود تحتاج انتباهك"
                        sub="إيجارات تنتهي خلال 60 يومًا"
                        action={
                          <Link href={`${base}/contracts`}>
                            كل العقود <ChevronLeft size={15} />
                          </Link>
                        }
                      />
                      <AssetTable
                        assets={expiring.slice(0, 5)}
                        onSelect={selectAsset}
                      />
                    </section>
                    <section className="card alerts-card">
                      <CardHead
                        title="مركز المتابعة"
                        sub="أولويات العمل القادمة"
                      />
                      <Link href={`${base}/conflicts`} className="alert-item">
                        <span className="alert-icon gold-bg">
                          <FileText size={20} />
                        </span>
                        <span>
                          <strong>
                            {number(expiring.length)} إيجارات قاربت الانتهاء
                          </strong>
                          <small>راجع فرص التجديد خلال 60 يومًا</small>
                        </span>
                        <ChevronLeft size={17} />
                      </Link>
                      <Link href={`${base}/conflicts`} className="alert-item">
                        <span
                          className={`alert-icon ${conflicts.length ? "red-bg" : "green-bg"}`}
                        >
                          <ShieldCheck size={20} />
                        </span>
                        <span>
                          <strong>
                            {conflicts.length
                              ? `${number(conflicts.length)} تعارضات في التغطية`
                              : "سلسلة التعاقد سليمة"}
                          </strong>
                          <small>
                            {conflicts.length
                              ? "تحتاج مراجعة العقود الصاعدة"
                              : "لا توجد تعارضات حالية مرصودة"}
                          </small>
                        </span>
                        <ChevronLeft size={17} />
                      </Link>
                      <div className="chain-mini">
                        <span>الجهة المالكة</span>
                        <ChevronLeft size={13} />
                        <span>الوطنية</span>
                        <ChevronLeft size={13} />
                        <b>شركتك</b>
                        <ChevronLeft size={13} />
                        <span>المعلن</span>
                      </div>
                      <p className="subtle">
                        لا تُقبل مدة إيجار تتجاوز التغطية الصاعدة إلا باستثناء
                        معتمد ومسجل.
                      </p>
                    </section>
                  </div>
                </>
              )}
              {section === "assets" && <LocationCoverage assets={d.assets} />}
              {section === "assets" && (
                <section className="card">
                  <div className="toolbar">
                    <div className="search-box">
                      <Search size={18} />
                      <input
                        aria-label="البحث في الأصول"
                        placeholder="ابحث بالكود أو الشارع أو المنطقة…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="تصفية الحالة"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">كل الحالات</option>
                      {["vacant", "leased", "expiring", "maintenance", "retired"].map(
                        (s) => (
                          <option key={s} value={s}>
                            {statuses[s]}
                          </option>
                        ),
                      )}
                    </select>
                    <div className="view-toggle">
                      <button
                        className={!mapView ? "selected" : ""}
                        onClick={() => setMapView(false)}
                        aria-label="عرض الجدول"
                      >
                        <LayoutGrid size={18} />
                      </button>
                      <button
                        className={mapView ? "selected" : ""}
                        onClick={() => setMapView(true)}
                        aria-label="عرض الخريطة"
                      >
                        <Map size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="results-label">
                    {number(filtered.length)} أصل · اضغط على الأصل لعرض تفاصيله
                  </div>
                  {mapView ? (
                    <AssetMap assets={filtered} onSelect={selectAsset} />
                  ) : (
                    <AssetTable assets={filtered} onSelect={selectAsset} />
                  )}
                </section>
              )}
              {section === "contracts" && (
                <section className="card">
                  <CardHead
                    title="سجل عقود المعلنين"
                    sub="الحجز محمي من تداخل الفترات وتجاوز التغطية"
                  />
                  <Table
                    headings={[
                      "رقم العقد",
                      "المعلن",
                      "الفترة",
                      "القيمة التقديرية¹",
                      "الحالة",
                    ]}
                  >
                    {d.contracts.map((c) => (
                      <tr key={c.id}>
                        <td className="code">{c.ref_no || "—"}</td>
                        <td>
                          {d.parties.find((p) => p.id === c.customer_id)
                            ?.name || "—"}
                        </td>
                        <td>
                          {formatDate(c.start_date)} ← {formatDate(c.end_date)}
                        </td>
                        <td>{money(c.total_value)}</td>
                        <td>
                          <Badge status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </Table>
                  <p className="table-note">
                    ¹ تقدير على أساس الشهر = 30 يومًا. الفوترة والتحصيل يُسجلان
                    بشكل مستقل. يعرض جميع عقد.
                  </p>
                </section>
              )}
              {section === "contracts" && <ContractOperations data={d} />}
              {section === "upstream" && (
                <ContractOperations data={d} upstream />
              )}
              {section === "upstream" && (
                <>
                  <div className="notice">
                    أدخل تكلفة التغطية الشهرية لكل عنصر صراحةً. اختيار نموذج
                    الدفع لا يوزّع التكلفة تلقائيًا.
                  </div>
                  <section className="card">
                    <Table
                      headings={[
                        "المرجع",
                        "البداية",
                        "النهاية",
                        "نموذج الدفع",
                        "القيمة السنوية",
                        "الحالة",
                      ]}
                    >
                      {d.upstream.map((u) => (
                        <tr key={u.id}>
                          <td>{u.ref_no}</td>
                          <td>{formatDate(u.start_date)}</td>
                          <td>{formatDate(u.end_date)}</td>
                          <td>
                            {{
                              lump_sum: "إجمالي العقد",
                              per_asset: "لكل عنصر",
                              per_m2: "لكل متر مربع",
                            }[u.billing_model] || u.billing_model}
                          </td>
                          <td>{money(u.annual_fee)}</td>
                          <td>
                            <Badge status={u.status} />
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </section>
                </>
              )}
              {section === "customers" && (
                <section className="card">
                  <CardHead
                    title="دليل العملاء والأطراف"
                    sub="المعلنون، الجهات المالكة، الشركات والموردون"
                  />
                  <Table
                    headings={[
                      "الاسم",
                      "النوع",
                      "الهاتف",
                      "الرقم الضريبي",
                      "موافقة واتساب",
                    ]}
                  >
                    {d.parties.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                        </td>
                        <td>
                          {
                            {
                              advertiser: "معلن",
                              agency: "وكالة",
                              authority: "جهة مالكة",
                              master_concessionaire: "الشركة الوطنية",
                              supplier: "مورد",
                            }[p.type]
                          }
                        </td>
                        <td dir="ltr">{p.phone || "—"}</td>
                        <td>{p.tax_no || "—"}</td>
                        <td>{p.wa_opt_in ? "موافق" : "غير مسجل"}</td>
                      </tr>
                    ))}
                  </Table>
                </section>
              )}
              {section === "geography" && (
                <>
                  <div className="inline-actions">
                    {canCreate && (
                      <>
                        <button
                          className="button secondary"
                          onClick={() => setModal("governorate")}
                        >
                          <Plus size={16} />
                          محافظة
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => setModal("district")}
                        >
                          <Plus size={16} />
                          منطقة / حي
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => setModal("asset_type")}
                        >
                          <Plus size={16} />
                          نوع أصل
                        </button>
                      </>
                    )}
                  </div>
                  <section className="card">
                    <Table
                      headings={[
                        "الشارع",
                        "المنطقة",
                        "نطاق الاستغلال",
                        "عدد الأصول",
                      ]}
                    >
                      {d.streets.map((s) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>
                            {
                              d.districts.find((x) => x.id === s.district_id)
                                ?.name
                            }
                          </td>
                          <td>
                            {s.holding === "full"
                              ? "الشارع بالكامل"
                              : "مواقع متفرقة"}
                          </td>
                          <td>
                            {number(
                              d.assets.filter((a) => a.street_id === s.id)
                                .length,
                            )}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </section>
                </>
              )}
              {section === "finance" && (
                <>
                  <div className="kpi-grid three">
                    <Kpi
                      title="مطلوب تحصيله"
                      value={money(
                        d.finance
                          .filter((f) => f.direction === "receivable")
                          .reduce(
                            (s, f) => s + Number(f.amount) - Number(f.paid),
                            0,
                          ),
                      )}
                      icon={<Wallet size={21} />}
                      footer="رصيد فواتير المعلنين"
                      tone="green"
                    />
                    <Kpi
                      title="مستحقات الدفع"
                      value={money(
                        d.finance
                          .filter((f) => f.direction === "payable")
                          .reduce(
                            (s, f) => s + Number(f.amount) - Number(f.paid),
                            0,
                          ),
                      )}
                      icon={<Building2 size={21} />}
                      footer="الوطنية وباقي الأطراف"
                      tone="gold"
                    />
                    <Kpi
                      title="المحصل بالفعل"
                      value={money(
                        d.finance
                          .filter((f) => f.direction === "receivable")
                          .reduce((s, f) => s + Number(f.paid), 0),
                      )}
                      icon={<Check size={21} />}
                      footer="دفعات مسجلة فقط"
                      tone="navy"
                    />
                  </div>
                  {!canFinance ? (
                    <Empty text="لا تملك صلاحية الاطلاع على الحسابات المالية." />
                  ) : (
                    <section className="card">
                      <Table
                        headings={[
                          "المرجع",
                          "الطرف",
                          "الاتجاه",
                          "القيمة",
                          "المدفوع",
                          "الاستحقاق",
                          "إجراء",
                        ]}
                      >
                        {d.finance.map((f) => (
                          <tr key={f.id}>
                            <td>{f.ref_no}</td>
                            <td>
                              {d.parties.find((p) => p.id === f.party_id)
                                ?.name || "—"}
                            </td>
                            <td>
                              {f.direction === "receivable" ? "تحصيل" : "دفع"}
                            </td>
                            <td>{money(f.amount)}</td>
                            <td>{money(f.paid)}</td>
                            <td>{formatDate(f.due_date)}</td>
                            <td>
                              <Link
                                className="text-button"
                                href={
                                  d.demo
                                    ? `/demo-invoice/${f.id}`
                                    : `/app/invoices/${f.id}`
                                }
                                target="_blank"
                              >
                                عرض / طباعة
                              </Link>
                              {Number(f.paid) < Number(f.amount) ? (
                                <button
                                  className="text-button"
                                  onClick={() => setModal(`payment:${f.id}`)}
                                >
                                  تسجيل دفعة
                                </button>
                              ) : (
                                <Badge status="paid" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </Table>
                    </section>
                  )}
                </>
              )}
              {section === "licenses" && (
                <section className="card">
                  <Table
                    headings={[
                      "رقم الترخيص",
                      "الأصل",
                      "جهة الإصدار",
                      "انتهاء الصلاحية",
                    ]}
                  >
                    {d.licenses.map((l) => (
                      <tr key={l.id}>
                        <td>{l.ref_no}</td>
                        <td>
                          {d.assets.find((a) => a.id === l.asset_id)?.code ||
                            "—"}
                        </td>
                        <td>{l.issuer}</td>
                        <td>{formatDate(l.expires_on)}</td>
                      </tr>
                    ))}
                  </Table>
                </section>
              )}
              {section === "conflicts" && (
                <>
                  <div className="notice">
                    تعرض هذه الشاشة التغطية غير الكافية، والاستثناءات المعتمدة،
                    ومواعيد انتهاء الإيجارات. الحجز المزدوج يُرفض داخل قاعدة
                    البيانات.
                  </div>
                  <section className="card">
                    <CardHead
                      title={`تعارضات التغطية الحالية (${number(conflicts.length)})`}
                      sub="راجع العقد الصاعد أو مدة عقد المعلن"
                    />
                    {conflicts.length ? (
                      <AssetTable assets={conflicts} onSelect={selectAsset} />
                    ) : (
                      <div className="all-clear">
                        <ShieldCheck size={40} />
                        <h3>لا توجد تعارضات حالية</h3>
                        <p>الأصول المؤجرة الحالية ضمن تغطيتها التعاقدية.</p>
                      </div>
                    )}
                  </section>
                  <section className="card">
                    <CardHead
                      title="الإيجارات القريبة من الانتهاء"
                      sub="خلال الستين يومًا القادمة"
                    />
                    <AssetTable assets={expiring} onSelect={selectAsset} />
                  </section>
                </>
              )}
              {section === "settings" && (
                <div className="settings-grid">
                  <section className="card padded">
                    <h2>هوية الشركة والموقع العام</h2>
                    <p className="subtle">
                      تظهر هذه البيانات في الموقع العام وصفحة الدخول.
                    </p>
                    <DataForm kind="brand" demo={d.demo}>
                      <div className="form-grid">
                        <Field
                          label="اسم الشركة"
                          name="name"
                          value={d.brand.name}
                        />
                        <Field
                          label="اللون الرئيسي"
                          name="primary_color"
                          type="color"
                          value={d.brand.primary_color}
                        />
                        <Field
                          label="رابط الشعار HTTPS"
                          name="logo_url"
                          value={d.brand.logo_url || ""}
                          required={false}
                        />
                        <label>
                          أو ارفع شعار الشركة
                          <input
                            type="file"
                            name="logo_file"
                            accept="image/png,image/jpeg,image/webp"
                          />
                          <small>PNG / JPG / WebP · حتى 2 ميجابايت</small>
                        </label>
                        <Field
                          label="هاتف التواصل"
                          name="contact_phone"
                          value={d.brand.contact_phone || ""}
                          required={false}
                        />
                        <Field
                          label="البريد الإلكتروني"
                          name="contact_email"
                          type="email"
                          value={d.brand.contact_email || ""}
                          required={false}
                        />
                        <Field
                          label="واتساب (بالصيغة الدولية)"
                          name="whatsapp"
                          value={d.brand.whatsapp || ""}
                          required={false}
                        />
                        <Field
                          label="العنوان"
                          name="address"
                          value={d.brand.address || ""}
                          required={false}
                        />
                      </div>
                      <Field
                        label="عنوان الموقع"
                        name="website_title"
                        value={d.brand.website_title || ""}
                        required={false}
                      />
                      <label>
                        وصف الشركة
                        <textarea
                          name="website_description"
                          defaultValue={d.brand.website_description || ""}
                          maxLength={2000}
                          rows={3}
                        />
                      </label>
                      <label className="check-label">
                        <input
                          name="public_site_enabled"
                          type="checkbox"
                          defaultChecked={d.brand.public_site_enabled}
                        />
                        تفعيل الموقع العام للشركة
                      </label>
                    </DataForm>
                  </section>
                  <div>
                    <section className="card padded">
                      <h2>وحدات مساحة العمل</h2>
                      <DataForm kind="modules" demo={d.demo}>
                        {navigation
                          .filter(
                            (n) =>
                              !["settings", "conflicts", "whatsapp"].includes(
                                n.id,
                              ),
                          )
                          .map((n) => (
                            <label className="module-option" key={n.id}>
                              <span>
                                <n.icon size={18} />
                                {n.label}
                              </span>
                              <input
                                type="checkbox"
                                name={n.module}
                                defaultChecked={enabled(n.module)}
                                disabled={n.id === "dashboard"}
                              />
                            </label>
                          ))}
                        <label className="module-option">
                          <span>
                            <Phone size={18} />
                            تذكيرات واتساب
                          </span>
                          <input
                            type="checkbox"
                            name="whatsapp"
                            defaultChecked={enabled("whatsapp")}
                          />
                        </label>
                      </DataForm>
                    </section>
                    <section className="card padded domain-card">
                      <Globe size={25} />
                      <h3>نطاق مستقل لشركتك</h3>
                      <p>
                        أضف النطاق في Vercel ثم سجّله في tenant_domains بعد
                        التحقق من الملكية. يُحدد النطاق هوية الشركة تلقائيًا.
                      </p>
                      <Link href={d.demo ? "/demo-site" : "/"} target="_blank">
                        معاينة موقع الشركة <ExternalLink size={15} />
                      </Link>
                    </section>
                  </div>
                  <WebsiteEditor data={d}/>
                </div>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>{d.brand.name} · منصة إدارة اللافتات الذكية</span>
            <span>بتوقيت القاهرة · الجنيه المصري</span>
          </footer>
        </main>
      </div>
      {modal && (
        <Modal
          title={
            modal.startsWith("payment")
              ? "تسجيل دفعة"
              : (
                  {
                    party: "إضافة عميل أو طرف",
                    asset: "إضافة أصل إعلاني",
                    contract: "إنشاء عقد معلن",
                    street: "إضافة شارع",
                    district: "إضافة منطقة",
                    governorate: "إضافة محافظة",
                    asset_type: "إضافة نوع أصل",
                    invoice: "إنشاء فاتورة",
                    license: "إضافة ترخيص",
                    upstream: "إنشاء عقد صاعد",
                  } as Record<string, string>
                )[modal] || "إضافة سجل"
          }
          onClose={() => setModal(null)}
        >
          <CreateForm kind={modal} d={d} />
        </Modal>
      )}
      {selected && (
        <Modal
          title={`بطاقة الأصل · ${selected.code}`}
          onClose={() => setSelected(null)}
        >
          <AssetRecord
            asset={d.assets.find((a) => a.id === selected.id) || selected}
            data={d} canEdit={canAssets && enabled("assets")} canFinance={canFinance}
          />
        </Modal>
      )}
    </div>
  );
}
function Kpi({
  title,
  value,
  icon,
  footer,
  tone,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  footer: string;
  tone: string;
}) {
  return (
    <section className="kpi card">
      <div className="kpi-top">
        <span>{title}</span>
        <span className={`kpi-icon ${tone}-bg`}>{icon}</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-footer">{footer}</div>
    </section>
  );
}
function CardHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>{statuses[status] || status}</span>
  );
}
function Empty({
  text = "لا توجد بيانات بعد. أضف أول سجل للبدء.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Layers size={30} />
      <p>{text}</p>
    </div>
  );
}
function Table({
  headings,
  children,
}: {
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {Array.isArray(children) && children.length === 0 && <Empty />}
    </div>
  );
}
function AssetTable({
  assets,
  onSelect,
}: {
  assets: Asset[];
  onSelect: (a: Asset) => void;
}) {
  return (
    <Table
      headings={["الأصل / الموقع", "نوع الأصل", "الحالة", "نهاية الإيجار", ""]}
    >
      {assets.map((a) => (
        <tr key={a.id} onClick={() => onSelect(a)} className="clickable">
          <td>
            <button className="asset-code" onClick={() => onSelect(a)}>
              {a.code}
            </button>
            <small className="cell-sub">{a.street_name}</small>
          </td>
          <td>{a.type_name}</td>
          <td>
            <Badge status={a.live_status} />
          </td>
          <td>{formatDate(a.lease_end)}</td>
          <td>
            <ChevronLeft size={16} />
          </td>
        </tr>
      ))}
    </Table>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ) || [],
        ).filter((node) => node.getClientRects().length > 0 && node.getAttribute("type") !== "hidden");
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق">
            <X size={21} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        lang={["number", "date", "datetime-local", "time"].includes(type) ? "en" : undefined}
        dir={["number", "date", "datetime-local", "time", "tel", "email"].includes(type) ? "ltr" : undefined}
        defaultValue={value}
        required={required}
        min={min}
        step={step}
      />
    </label>
  );
}
function Select({
  label,
  name,
  rows,
  multiple = false,
  required = true,
}: {
  label: string;
  name: string;
  rows: { id: string; name: string }[];
  multiple?: boolean;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        required={required}
        name={name}
        multiple={multiple}
        defaultValue={multiple ? [] : ""}
      >
        {!multiple && (
          <option value="" disabled>
            اختر…
          </option>
        )}
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {!rows.length && <small>أضف السجلات المطلوبة أولًا.</small>}
      {multiple && <small>يمكن اختيار أكثر من أصل باستخدام Ctrl أو ⌘.</small>}
    </label>
  );
}
function CreateForm({ kind, d }: { kind: string; d: WorkspaceData }) {
  const [assetPoint, setAssetPoint] = useState<MapPoint | null>(null);
  const clearAssetPoint = useCallback(() => setAssetPoint(null), []);
  const assetCenter = d.assets.find((asset) => asset.latitude != null && asset.longitude != null);
  const actual = kind.startsWith("payment:") ? "payment" : kind;
  const invoice = d.finance.find((f) => f.id === kind.split(":")[1]);
  return (
    <DataForm
      key={kind}
      kind={actual}
      demo={d.demo}
      disabled={actual === "asset" && !assetPoint}
      onSuccess={actual === "asset" ? clearAssetPoint : undefined}
      label={actual === "contract" ? "فحص التوفر وإنشاء العقد" : "حفظ البيانات"}
    >
      {actual === "party" && (
        <>
          <Field label="الاسم" name="name" />
          <label>
            نوع الطرف
            <select name="type">
              {Object.entries({
                advertiser: "معلن",
                master_concessionaire: "الشركة الوطنية",
                authority: "جهة مالكة",
                agency: "وكالة",
                supplier: "مورد",
              }).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <Field label="الهاتف" name="phone" required={false} />
          <Field label="الرقم الضريبي" name="tax_no" required={false} />
          <Field label="رقم واتساب الدولي" name="whatsapp" required={false} />
          <label className="check-label">
            <input name="wa_opt_in" type="checkbox" />
            حصلنا على موافقة الطرف لتلقي رسائل واتساب
          </label>
        </>
      )}
      {actual === "asset" && (
        <>
          <Field label="كود الأصل" name="code" />
          <Select label="الشارع" name="street_id" rows={d.streets} />
          <Select label="نوع الأصل" name="type_id" rows={d.assetTypes} />
          <LocationPicker value={assetPoint} onChange={setAssetPoint} center={assetCenter ? { latitude: Number(assetCenter.latitude), longitude: Number(assetCenter.longitude) } : undefined} />
          <label>صورة أولية للأصل (اختياري)<input type="file" name="asset_photo" accept="image/png,image/jpeg,image/webp" /><small>حتى 2 ميجابايت. يمكنك رفع صور إضافية من بطاقة الأصل بعد حفظه؛ الصور خاصة بالشركة.</small></label>
          <div className="form-grid">
            <Field
              label="الطول (م)"
              name="length_m"
              type="number"
              min="0.01"
              step="0.01"
            />
            <Field
              label="العرض (م)"
              name="width_m"
              type="number"
              min="0.01"
              step="0.01"
            />
            <Field
              label="عدد الأوجه"
              name="faces"
              type="number"
              min="1"
              value="1"
            />
            <Field label="المعدن" name="material" required={false} />
          </div>
          <label className="check-label">
            <input type="checkbox" name="public_visible" />
            عرض هذا الأصل في موقع الشركة العام
          </label>
          <div className="form-grid">
            <Field
              label="تكلفة اقتناء الأصل"
              name="cost"
              type="number"
              min="0"
              step="0.01"
              required={false}
            />
            <Field
              label="تاريخ التركيب"
              name="install_date"
              type="date"
              required={false}
            />
            <Field
              label="العمر الإنتاجي بالأشهر"
              name="useful_life_months"
              type="number"
              min="1"
              required={false}
            />
          </div>
        </>
      )}
      {actual === "contract" && (
        <>
          <div className="notice">
            يفحص النظام تغطية العقد الصاعد ويمنع الحجز المزدوج قبل حفظ العقد
            بالكامل.
          </div>
          <Select
            label="المعلن"
            name="customer_id"
            rows={d.parties.filter((p) => p.type === "advertiser")}
          />
          <Field label="مرجع العقد" name="ref_no" />
          <div className="form-grid">
            <Field label="تاريخ البداية" name="start_date" type="date" />
            <Field label="تاريخ النهاية (شامل)" name="end_date" type="date" />
          </div>
          <Select
            label="الأصول"
            name="asset_id"
            rows={d.assets.filter((a) => a.live_status !== "retired").map((a) => ({
              id: a.id,
              name: `${a.code} · ${a.street_name}`,
            }))}
            multiple
          />
          <Field
            label="الإيجار الشهري لكل أصل (ج.م)"
            name="monthly_price"
            type="number"
            min="0"
            step="0.01"
          />
          {d.profile.role === "admin" && (
            <label>
              سبب الاستثناء من التغطية (اختياري)
              <textarea
                name="override_reason"
                placeholder="اتركه فارغًا للتطبيق العادي. الاستثناء يُسجل باسمك."
                minLength={10}
              />
            </label>
          )}
        </>
      )}
      {actual === "governorate" && <Field label="اسم المحافظة" name="name" />}
      {actual === "district" && (
        <>
          <Field label="اسم المنطقة / الحي" name="name" />
          <Select
            label="المحافظة"
            name="governorate_id"
            rows={d.governorates}
          />
        </>
      )}
      {actual === "street" && (
        <>
          <Field label="اسم الشارع" name="name" />
          <Select
            label="المنطقة / الحي"
            name="district_id"
            rows={d.districts}
          />
          <label>
            نطاق الاستغلال
            <select name="holding">
              <option value="partial">مواقع متفرقة</option>
              <option value="full">الشارع بالكامل</option>
            </select>
          </label>
        </>
      )}
      {actual === "asset_type" && (
        <>
          <Field label="اسم النوع" name="name" />
          <label>
            الفئة
            <select name="category">
              <option value="pole">عمود إعلاني</option>
              <option value="sidewalk_sign">لافتة رصيف</option>
              <option value="billboard">لوحة طرق</option>
              <option value="other">أخرى</option>
            </select>
          </label>
        </>
      )}
      {actual === "payment" && (
        <>
          <input type="hidden" name="invoice_id" value={invoice?.id || ""} />
          <div className="notice">
            الفاتورة {invoice?.ref_no} · المتبقي{" "}
            {money(Number(invoice?.amount) - Number(invoice?.paid))}
          </div>
          <Field
            label="قيمة الدفعة (ج.م)"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
          />
          <Field label="تاريخ الدفع" name="paid_on" type="date" />
          <Select
            label="الخزينة أو البنك"
            name="cash_account_id"
            rows={d.operations.cashAccounts.map((c) => ({
              id: c.id,
              name: `${c.name} · ${money(c.balance)}`,
            }))}
          />
          <Field label="مرجع الدفع" name="reference" required={false} />
        </>
      )}
      {actual === "invoice" && <ItemizedInvoiceFields data={d} />}
      {actual === "license" && (
        <>
          <Select
            label="الأصل"
            name="asset_id"
            rows={d.assets.filter((a) => a.live_status !== "retired").map((a) => ({ id: a.id, name: a.code }))}
          />
          <Field label="رقم الترخيص" name="ref_no" />
          <Field label="جهة الإصدار" name="issuer" />
          <Field label="تاريخ الانتهاء" name="expires_on" type="date" />
        </>
      )}
      {actual === "upstream" && (
        <>
          <Field label="مرجع العقد" name="ref_no" />
          <Select
            label="الجهة المالكة"
            name="grantor_party_id"
            required={false}
            rows={d.parties.filter((p) => p.type === "authority")}
          />
          <Select
            label="صاحب حق الاستغلال (الوطنية)"
            name="master_party_id"
            required={false}
            rows={d.parties.filter((p) => p.type === "master_concessionaire")}
          />
          <p className="subtle">
            اختر طرفًا واحدًا على الأقل لربط مستحقات وأقساط العقد بالجهة
            الصحيحة.
          </p>
          <div className="form-grid">
            <Field label="البداية" name="start_date" type="date" />
            <Field label="النهاية" name="end_date" type="date" />
          </div>
          <label>
            نموذج الدفع
            <select name="billing_model">
              <option value="lump_sum">إجمالي العقد</option>
              <option value="per_asset">لكل عنصر</option>
              <option value="per_m2">لكل متر مربع</option>
            </select>
          </label>
          <Field
            label="إجمالي القيمة السنوية (ج.م)"
            name="annual_fee"
            type="number"
            min="0"
            step="0.01"
          />
          <Select
            label="الأصول المشمولة"
            name="asset_id"
            rows={d.assets.filter((a) => a.live_status !== "retired").map((a) => ({ id: a.id, name: a.code }))}
            multiple
          />
          <Field
            label="التكلفة الشهرية المخصصة لكل أصل محدد (ج.م)"
            name="monthly_cost"
            type="number"
            min="0"
            step="0.01"
          />
          <p className="subtle">
            القيمة موزعة يدويًا؛ لا يعتمد هذا النموذج توزيعًا تلقائيًا للتكلفة.
          </p>
        </>
      )}
    </DataForm>
  );
}
