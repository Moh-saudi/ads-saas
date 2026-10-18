"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { Asset } from "@/lib/types";
import { parseCoordinates } from "@/lib/coordinates.mjs";
import { DataForm } from "./forms";
const LocationPicker = dynamic(() => import("./location-picker").then((m) => m.LocationPicker), { ssr: false, loading: () => <p>جارٍ تحميل الخريطة…</p> });
export function AssetLocation({ asset, demo }: { asset: Asset; demo: boolean }) {
  const [point, setPoint] = useState(() => parseCoordinates(asset.latitude, asset.longitude));
  return <details className="asset-section"><summary>ضبط الموقع الدقيق على الخريطة</summary>
    <DataForm kind="asset_location" demo={demo} disabled={!point} label="حفظ الموقع الدقيق">
      <input type="hidden" name="id" value={asset.id} />
      <LocationPicker value={point} onChange={setPoint} />
      <label>سبب تصحيح الموقع<textarea name="reason" minLength={10} maxLength={1000} required /></label>
      <p className="subtle">تتحدث نقطة الأصل على الخرائط بعد الحفظ؛ المنطقة والشارع يتبعان التسجيل الإداري ولا يُستنتجان من النقطة.</p>
    </DataForm>
  </details>;
}
