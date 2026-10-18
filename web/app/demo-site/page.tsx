import { PublicSite } from "@/components/public-site";
import { demoData } from "@/lib/demo";
export const metadata = { title: "معاينة موقع عميل" };
export default function Page() {
  const d = demoData();
  return (
    <PublicSite
      brand={d.brand}
      demo
      catalog={d.assets
        .slice(0, 6)
        .map((a) => ({
          code: a.code,
          street: a.street_name,
          category: a.type_name,
          length_m: a.length_m,
          width_m: a.width_m,
          faces: a.faces,
        }))}
    />
  );
}
