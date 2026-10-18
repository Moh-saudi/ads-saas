import { notFound } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { Workspace } from "@/components/workspace";
import {allSections as sections} from '@/lib/operations-types';
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  const data = await loadWorkspace();
  return <Workspace data={data} section={section} />;
}
