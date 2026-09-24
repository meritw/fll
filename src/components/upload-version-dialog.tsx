"use client";

import { ProgramForm } from "@/components/program-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type MissionChoice = {
  id: number;
  number: number;
  name: string;
};

export function UploadVersionDialog({
  programId,
  programName,
  defaultMissionIds,
  missions,
}: {
  programId: string;
  programName: string;
  defaultMissionIds: number[];
  missions: MissionChoice[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="xl" variant="secondary">
          Upload new version
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Upload new version</DialogTitle>
          <DialogDescription className="text-base">
            Upload a new .llsp3 for {programName}. Missions start from the latest version.
          </DialogDescription>
        </DialogHeader>
        <ProgramForm
          mode="version"
          programId={programId}
          defaultName={programName}
          defaultMissionIds={defaultMissionIds}
          missions={missions}
          showSaveName={false}
        />
      </DialogContent>
    </Dialog>
  );
}
