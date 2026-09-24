import type { Metadata } from "next";

import { ProgramForm } from "@/components/program-form";
import { listMissions } from "@/lib/programs";

export const metadata: Metadata = {
  title: "Add a program",
};

export default async function NewProgramPage() {
  const missions = await listMissions();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Add a program</h1>
      <ProgramForm mode="create" defaultName="" defaultMissionIds={[]} missions={missions} />
    </div>
  );
}
