import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { demoData } from "@/lib/demo";
import {allSections} from '@/lib/operations-types';
export const dynamic = "force-dynamic";
export const metadata = { title: "معاينة المنصة · بيانات تجريبية" };
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const s = section?.[0] || "dashboard";
  if (
    (section?.length || 0) > 1 ||
    !allSections.includes(s)
  )
    notFound();
  return <Workspace data={demoData()} section={s} />;
}
