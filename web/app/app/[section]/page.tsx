import { notFound } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { Workspace } from "@/components/workspace";
import { allSections as sections } from "@/lib/operations-types";
import { demoData } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  try {
    const data = await loadWorkspace();
    return <Workspace data={data} section={section} />;
  } catch (err: any) {
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    console.warn("loadWorkspace failed in section page, falling back to demoData():", err);
    return <Workspace data={demoData()} section={section} />;
  }
}
