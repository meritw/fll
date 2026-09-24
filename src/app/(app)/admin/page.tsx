import type { Metadata } from "next";

import { AddCoachForm, AddStudentForm, ResetPasswordForm } from "@/components/admin-forms";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPeople } from "@/lib/accounts";
import { requireCoach } from "@/lib/session";

export const metadata: Metadata = {
  title: "People",
};

export default async function AdminPage() {
  await requireCoach();
  const people = await listPeople();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold">People</h1>
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <Table className="w-full text-lg">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-14 px-4 text-lg font-semibold">Name</TableHead>
              <TableHead className="h-14 px-4 text-lg font-semibold">Username</TableHead>
              <TableHead className="h-14 px-4 text-lg font-semibold">Role</TableHead>
              <TableHead className="h-14 px-4 text-lg font-semibold">Email</TableHead>
              <TableHead className="h-14 w-[1%] whitespace-nowrap px-4 text-right text-lg font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="px-4 py-4 font-medium">{person.name}</TableCell>
                <TableCell className="px-4 py-4">{person.username}</TableCell>
                <TableCell className="px-4 py-4">
                  {person.role === "coach" ? "Coach" : "Student"}
                </TableCell>
                <TableCell className="max-w-[18rem] truncate px-4 py-4" title={person.email ?? undefined}>
                  {person.email ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-4 text-right">
                  {person.role === "student" ? (
                    <ResetPasswordForm userId={person.id} name={person.name} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Separator />
      <AddStudentForm />
      <Separator />
      <AddCoachForm />
    </div>
  );
}
