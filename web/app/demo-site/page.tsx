import { ProductShowcase } from "@/components/product-showcase";
import { showcaseMetadata } from "@/lib/share-metadata";
export const metadata = showcaseMetadata();
export default function Page() { return <ProductShowcase />; }
