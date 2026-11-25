"use client";
import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { parseCoordinates } from "@/lib/coordinates.mjs";
import "leaflet/dist/leaflet.css";
export type MapPoint = { latitude: number; longitude: number };

export function LocationPicker({ value, onChange, center }: {
  value: MapPoint | null; onChange: (point: MapPoint | null) => void; center?: MapPoint;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [ready, setReady] = useState(false), [message, setMessage] = useState("");
  const [tileError, setTileError] = useState(false), [locating, setLocating] = useState(false);
  const [coordinateText, setCoordinateText] = useState("");
  const mounted = useRef(false);
  const locationRequest = useRef(0);
  const start = useRef(value || center || { latitude: 30.0444, longitude: 31.2357 });

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      leafletRef.current = L;
      map = L.map(container.current, { scrollWheelZoom: false }).setView([start.current.latitude, start.current.longitude], 13);
      mapRef.current = map;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19,
      });
      tiles.on("tileerror", () => { if (!disposed) setTileError(true); });
      tiles.addTo(map);
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        const point = parseCoordinates(event.latlng.lat, event.latlng.wrap().lng);
        if (point) { locationRequest.current++; setLocating(false); changeRef.current(point); setMessage("تم اختيار النقطة. يمكنك سحب العلامة لضبط الموقع."); }
      });
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    }).catch(() => { if (!disposed) setMessage("تعذر تحميل الخريطة. أعد فتح النموذج أو تحقق من الاتصال."); });
    return () => {
      disposed = true; mounted.current = false; observer?.disconnect(); map?.remove();
      mapRef.current = null; markerRef.current = null; leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current;
    if (!ready || !map || !L) return;
    if (!value) { markerRef.current?.remove(); markerRef.current = null; locationRequest.current++; setLocating(false); setMessage(""); return; }
    const point: import("leaflet").LatLngTuple = [value.latitude, value.longitude];
    if (!markerRef.current) {
      const marker = L.marker(point, {
        draggable: true, title: "الموقع المحدد — اسحب العلامة لتغييره", alt: "علامة الموقع المحدد",
        icon: L.divIcon({ className: "location-pin", html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 36] }),
      }).addTo(map);
      marker.on("dragend", () => {
        const location = marker.getLatLng();
        const selected = parseCoordinates(location.lat, location.wrap().lng);
        if (selected) { locationRequest.current++; setLocating(false); changeRef.current(selected); }
      });
      markerRef.current = marker;
    } else markerRef.current.setLatLng(point);
    if (!map.getBounds().contains(point)) map.panTo(point);
  }, [ready, value]);

  function locate() {
    if (!navigator.geolocation) { setMessage("تحديد الموقع غير متاح في هذا المتصفح. اختر النقطة على الخريطة."); return; }
    const request = ++locationRequest.current;
    setLocating(true); setMessage("جارٍ تحديد موقع جهازك…");
    navigator.geolocation.getCurrentPosition((result) => {
      if (!mounted.current || locationRequest.current !== request) return;
      setLocating(false);
      const point = parseCoordinates(result.coords.latitude, result.coords.longitude);
      if (!point) { setMessage("تعذر الحصول على إحداثيات صالحة."); return; }
      changeRef.current(point); mapRef.current?.setView([point.latitude, point.longitude], 17);
      setMessage(`تم تحديد موقع جهازك بدقة تقريبية ${Math.ceil(result.coords.accuracy)} متر. راجع العلامة قبل الحفظ.`);
    }, (error) => {
      if (!mounted.current || locationRequest.current !== request) return;
      setLocating(false);
      setMessage(error.code === 1 ? "لم تسمح بمشاركة موقعك. يمكنك اختيار النقطة يدويًا على الخريطة." : "تعذر تحديد موقع الجهاز. اختر النقطة على الخريطة أو أعد المحاولة.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

  return <section className="location-picker" aria-label="اختيار الموقع الجغرافي">
    <div className="location-picker-heading"><div><h3><MapPin size={18} />الموقع الفعلي على الخريطة</h3><p>كبّر الخريطة واضغط على مكان اللوحة، ثم اسحب العلامة لضبط النقطة بدقة.</p></div>
      <button type="button" className="button secondary" disabled={!ready || locating} onClick={locate}><LocateFixed size={16} />{locating ? "جارٍ التحديد…" : "استخدم موقعي"}</button>
    </div>
    <div ref={container} className="location-picker-map" role="region" aria-label="خريطة اختيار الموقع، اضغط لتثبيت العلامة" />
    {tileError && <p className="notice danger" role="alert">تعذر تحميل بعض تفاصيل الخريطة. تحقق من الاتصال قبل تأكيد دقة النقطة.</p>}
    <div className="location-coordinate-search"><label>انتقل إلى إحداثيات معروفة<input dir="ltr" placeholder="30.0444, 31.2357" value={coordinateText} onChange={(event) => setCoordinateText(event.target.value)} /></label>
      <button type="button" className="button secondary" disabled={!ready} onClick={() => {
        const parts = coordinateText.trim().replace(/[()]/g, "").split(/[,،\s]+/);
        const point = parts.length === 2 ? parseCoordinates(parts[0], parts[1]) : null;
        if (!point) { setMessage("أدخل خط العرض ثم خط الطول، مثل 30.0444, 31.2357."); return; }
        locationRequest.current++; setLocating(false);
        changeRef.current(point); mapRef.current?.setView([point.latitude, point.longitude], 17);
        setMessage("تم الانتقال إلى النقطة. راجع موضع العلامة على الخريطة.");
      }}>عرض النقطة</button>
    </div>
    <div className="form-grid"><label>خط العرض<input name="latitude" type="number" lang="en" dir="ltr" step="any" required readOnly value={value?.latitude.toFixed(7) ?? ""} /></label>
      <label>خط الطول<input name="longitude" type="number" lang="en" dir="ltr" step="any" required readOnly value={value?.longitude.toFixed(7) ?? ""} /></label></div>
    <p role="status" className="location-picker-status">{message || (value ? "تم تحديد الموقع." : "اختر نقطة أولًا؛ مركز الخريطة الافتراضي لا يُحفظ كموقع.")}</p>
    {value && <button type="button" className="text-button" onClick={() => { onChange(null); setMessage(""); }}>مسح النقطة وإعادة الاختيار</button>}
    <small>اختيار النقطة لا يحدد حدود الحي أو الشارع تلقائيًا؛ اختر الشارع المسجل المطابق للموقع.</small>
  </section>;
}
