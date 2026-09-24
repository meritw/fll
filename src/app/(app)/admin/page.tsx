import type { Metadata } from "next";

import { AddCoachForm, AddStudentForm, ResetPasswordForm } from "@/components/admin-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
      <div className="flex flex-col gap-4">
        {people.map((person) => (
          <Card key={person.id} className="text-lg">
            <CardHeader>
              <CardTitle className="text-2xl">{person.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Username: {person.username}</p>
              <p>{person.role === "coach" ? "Coach" : "Student"}</p>
              {person.email ? <p>{person.email}</p> : null}
              {person.role === "student" ? (
                <ResetPasswordForm userId={person.id} name={person.name} />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <Separator />
      <AddStudentForm />
      <Separator />
      <AddCoachForm />
    </div>
  );
}
