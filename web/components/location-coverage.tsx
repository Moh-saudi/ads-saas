import type { Asset } from "@/lib/types";
import { locationCoverage } from "@/lib/coordinates.mjs";
export function LocationCoverage({ assets }: { assets: Asset[] }) {
  const summary = locationCoverage(assets);
  return <section className="card location-coverage" aria-label="تغطية المواقع الجغرافية">
    <div><h2>تحديد المواقع على الخريطة</h2><p>اللوحات التي لها إحداثيات مسجلة تظهر على الخريطة. اللوحات المستبعدة غير محسوبة في هذه الأرقام.</p></div>
    <dl><div><dt>محددة على الخريطة</dt><dd>{summary.located}</dd></div><div><dt>تحتاج تحديد الموقع</dt><dd>{summary.missing}</dd></div><div><dt>نسبة اللوحات المحددة</dt><dd>{summary.percent}%</dd></div></dl>
  </section>;
}
