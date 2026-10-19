"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DataForm } from "./forms";
import type { WorkspaceData } from "@/lib/types";
import type { ActionState } from "@/app/actions";

type Level = "governorate" | "district" | "street";
const labels = { governorate: "محافظة", district: "منطقة / حي", street: "شارع" };

/** Shared hierarchy for both managing locations and assigning a billboard. */
export function LocationHierarchy({ d, required = true, onStreetChange, onHierarchyChange, initialStreet = "" }: {
  d: WorkspaceData; required?: boolean; initialStreet?: string; onStreetChange?: (id: string) => void;
  onHierarchyChange?: (value: { governorate: string; district: string; street: string }) => void;
}) {
  const initialDistrict = d.streets.find(x => x.id === initialStreet)?.district_id ?? "";
  const initialGovernorate = d.districts.find(x => x.id === initialDistrict)?.governorate_id ?? "";
  const [governorate, setGovernorate] = useState(initialGovernorate);
  const [district, setDistrict] = useState(initialDistrict);
  const [street, setStreet] = useState(initialStreet);
  const [extraGovernorates, setExtraGovernorates] = useState<WorkspaceData["governorates"]>([]);
  const [extraDistricts, setExtraDistricts] = useState<WorkspaceData["districts"]>([]);
  const [extraStreets, setExtraStreets] = useState<WorkspaceData["streets"]>([]);
  const [adding, setAdding] = useState<Level | null>(null);
  const [name, setName] = useState("");
  const [holding, setHolding] = useState("partial");
  const dialog = useRef<HTMLDialogElement>(null);
  const canManage = d.profile.role === "admin";
  const governorates = [...d.governorates, ...extraGovernorates.filter(x => !d.governorates.some(y => y.id === x.id))];
  const districts = [...d.districts, ...extraDistricts.filter(x => !d.districts.some(y => y.id === x.id))].filter(x => x.governorate_id === governorate);
  const streets = [...d.streets, ...extraStreets.filter(x => !d.streets.some(y => y.id === x.id))].filter(x => x.district_id === district);
  useEffect(() => { if (adding) dialog.current?.showModal(); }, [adding]);
  useEffect(() => { onHierarchyChange?.({ governorate, district, street }); }, [governorate, district, street, onHierarchyChange]);
  const saved = useCallback((state: ActionState) => {
    if (!state.id || !adding) return;
    const row = { id: state.id, name: name.trim() };
    if (adding === "governorate") { setExtraGovernorates(rows => [...rows, row]); setGovernorate(row.id); setDistrict(""); setStreet(""); onStreetChange?.(""); }
    if (adding === "district") { setExtraDistricts(rows => [...rows, { ...row, governorate_id: governorate }]); setDistrict(row.id); setStreet(""); onStreetChange?.(""); }
    if (adding === "street") { setExtraStreets(rows => [...rows, { ...row, district_id: district, holding }]); setStreet(row.id); onStreetChange?.(row.id); }
    setAdding(null);
  }, [adding, name, governorate, district, holding, onStreetChange]);
  const levels = [
    { kind: "governorate" as const, title: "١. المحافظة", value: governorate, rows: governorates, enabled: true, change: (id: string) => { setGovernorate(id); setDistrict(""); setStreet(""); onStreetChange?.(""); } },
    { kind: "district" as const, title: "٢. المنطقة / الحي", value: district, rows: districts, enabled: !!governorate, change: (id: string) => { setDistrict(id); setStreet(""); onStreetChange?.(""); } },
    { kind: "street" as const, title: "٣. الشارع", value: street, rows: streets, enabled: !!district, change: (id: string) => { setStreet(id); onStreetChange?.(id); } },
  ];
  return <fieldset className="location-hierarchy">
    <legend>عنوان موقع الإعلان</legend>
    <p>اختر المحافظة ثم المنطقة ثم الشارع. بعد ذلك حدّد نقطة اللوحة بدقة على الخريطة.</p>
    <div className="form-grid">{levels.map(level => <div key={level.kind}>
      <label>{level.title}<select name={level.kind === "street" ? "street_id" : undefined} required={required} value={level.value} disabled={!level.enabled} onChange={event => level.change(event.target.value)}>
        <option value="">{level.enabled ? `اختر ${labels[level.kind]}` : "اختر المستوى السابق أولًا"}</option>
        {level.rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      {canManage && <button type="button" className="button secondary" disabled={!level.enabled} onClick={() => { setName(""); setHolding("partial"); setAdding(level.kind); }}>+ إضافة {labels[level.kind]}</button>}
      {level.enabled && !level.rows.length && <small>لا توجد بيانات هنا بعد.{canManage ? " أضفها من الزر أعلاه." : " اطلب من مسؤول الشركة إضافتها."}</small>}
    </div>)}</div>
    {adding && createPortal(<dialog ref={dialog} className="modal location-dialog" onCancel={() => setAdding(null)} aria-labelledby="location-dialog-title">
      <div className="modal-head"><h2 id="location-dialog-title">إضافة {labels[adding]}</h2><button type="button" className="button secondary" onClick={() => setAdding(null)} aria-label="إغلاق">إغلاق</button></div>
      <p>{governorates.find(x => x.id === governorate)?.name}{adding === "street" ? ` ← ${districts.find(x => x.id === district)?.name ?? ""}` : ""}</p>
      <DataForm kind={adding} demo={d.demo} onSuccess={saved} label="حفظ واختيار هذا الموقع">
        <label>اسم {labels[adding]}<input name="name" required autoFocus value={name} onChange={event => setName(event.target.value)} /></label>
        {adding === "district" && <input type="hidden" name="governorate_id" value={governorate} />}
        {adding === "street" && <><input type="hidden" name="district_id" value={district} /><label>نطاق التعاقد<select name="holding" value={holding} onChange={event => setHolding(event.target.value)}><option value="partial">مواقع متفرقة</option><option value="full">الشارع بالكامل</option></select></label></>}
      </DataForm>
    </dialog>, document.body)}
  </fieldset>;
}
