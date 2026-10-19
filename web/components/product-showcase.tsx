import { PublicSite } from "./public-site";
import { demoData } from "@/lib/demo";

export function ProductShowcase() {
  const d = demoData();
  return <PublicSite brand={d.brand} demo areas={d.districts.map(a => a.name)}
    catalog={d.assets.slice(0, 6).map(a => ({ code: a.code, street: a.street_name, category: a.type_name, length_m: a.length_m, width_m: a.width_m, faces: a.faces }))} />;
}
