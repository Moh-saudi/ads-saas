"use client";
import { useEffect, useRef } from "react";
import type { Asset } from "@/lib/types";
import "leaflet/dist/leaflet.css";
export function AssetMap({
  assets,
  onSelect,
}: {
  assets: Asset[];
  onSelect?: (asset: Asset) => void;
}) {
  const div = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !div.current) return;
      map = L.map(div.current, { scrollWheelZoom: false }).setView(
        [30.045, 31.47],
        11,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      const points: import("leaflet").LatLngTuple[] = [];
      for (const a of assets) {
        if (a.latitude == null || a.longitude == null) continue;
        const pt: import("leaflet").LatLngTuple = [
          Number(a.latitude),
          Number(a.longitude),
        ];
        points.push(pt);
        const color = a.live_status === "retired" ? "#7b8597" :
          a.live_status === "vacant"
            ? "#168a45"
            : a.live_status === "expiring"
              ? "#d4a017"
              : a.live_status === "maintenance"
                ? "#c55f59"
                : "#0b1f4d";
        const marker = L.circleMarker(pt, {
          radius: 8,
          fillColor: color,
          color: "white",
          weight: 3,
          fillOpacity: 1,
        }).addTo(map!);
        const label = document.createElement("span");
        label.textContent = `${a.code} · ${a.street_name}`;
        marker.bindTooltip(label);
        marker.on("click", () => onSelect?.(a));
      }
      if (points.length)
        map.fitBounds(L.latLngBounds(points), {
          padding: [38, 38],
          maxZoom: 15,
        });
    });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [assets, onSelect]);
  return (
    <div ref={div} className="asset-map" aria-label="خريطة المواقع الإعلانية" />
  );
}
