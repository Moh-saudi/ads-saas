import { normalizeHost } from "./host";

// Only the developer's public sales demo uses a fixed identity. Customer hosts
// and every authenticated route continue to use the verified tenant mapping.
export function isShowcaseHost(host: string) {
  return normalizeHost(host) === "ads-kappa-one.vercel.app";
}
