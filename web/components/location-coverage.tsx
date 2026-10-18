import type { Asset } from "@/lib/types";
import { locationCoverage } from "@/lib/coordinates.mjs";
export function LocationCoverage({ assets }: { assets: Asset[] }) {
  const summary = locationCoverage(assets);
  return <section className="card location-coverage" aria-label="تغطية المواقع الجغرافية">
    <div><h2>دقة سجل المواقع</h2><p>الأصول التشغيلية ذات النقاط الصحيحة تظهر على الخريطة. المستبعدات خارج هذه المؤشرات.</p></div>
    <dl><div><dt>محددة على الخريطة</dt><dd>{summary.located}</dd></div><div><dt>تحتاج تحديد الموقع</dt><dd>{summary.missing}</dd></div><div><dt>تغطية التحديد الجغرافي</dt><dd>{summary.percent}%</dd></div></dl>
  </section>;
}
