"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCoach, addStudent, setStudentPassword, type ActionState } from "@/lib/actions";

const fieldClass = "h-12 px-3 text-lg md:text-lg";
const initialState: ActionState = {};

export function AddStudentForm() {
  return (
    <PersonForm
      idPrefix="student"
      title="Add a student"
      action={addStudent}
      includeEmail={false}
    />
  );
}

export function AddCoachForm() {
  return <PersonForm idPrefix="coach" title="Add a coach" action={addCoach} includeEmail />;
}

function PersonForm({
  idPrefix,
  title,
  action,
  includeEmail,
}: {
  idPrefix: string;
  title: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  includeEmail: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <Field idPrefix={idPrefix} label="Username" name="username" autoComplete="off" />
      <Field idPrefix={idPrefix} label="Display name" name="displayName" autoComplete="name" />
      {includeEmail ? (
        <Field idPrefix={idPrefix} label="Email" name="email" type="email" autoComplete="off" />
      ) : null}
      <Field
        idPrefix={idPrefix}
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
      />
      <FormNotice state={state} />
      <Button type="submit" size="xl" disabled={pending}>
        {title}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ userId, name }: { userId: string; name: string }) {
  const [state, formAction, pending] = useActionState(setStudentPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <Label htmlFor={`password-${userId}`} className="text-lg">
        New password for {name}
      </Label>
      <Input
        id={`password-${userId}`}
        name="password"
        type="password"
        autoComplete="new-password"
        className={fieldClass}
        required
      />
      <FormNotice state={state} />
      <Button type="submit" size="xl" variant="secondary" disabled={pending}>
        Set password
      </Button>
    </form>
  );
}

function Field({
  idPrefix,
  label,
  name,
  type = "text",
  autoComplete,
}: {
  idPrefix: string;
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
}) {
  const id = `${idPrefix}-${name}`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-lg">
        {label}
      </Label>
      <Input id={id} name={name} type={type} autoComplete={autoComplete} className={fieldClass} required />
    </div>
  );
}

function FormNotice({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="text-lg">{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.message) {
    return (
      <Alert>
        <AlertDescription className="text-lg">{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
