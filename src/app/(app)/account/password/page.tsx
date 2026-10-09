import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/change-password-form";
import { hasPasswordLogin } from "@/lib/accounts";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Change password",
};

export default async function ChangePasswordPage() {
  const session = await requireUser();
  const hasPassword = await hasPasswordLogin(session.user.id);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Change password</h1>
        <p className="text-lg text-muted-foreground">
          {hasPassword
            ? `For ${session.user.username ?? session.user.name}. You stay signed in here. Other devices get signed out and need the new password.`
            : "You sign in with an email link or code, so there's no password to change."}
        </p>
      </div>
      {hasPassword ? <ChangePasswordForm /> : null}
    </div>
  );
}
