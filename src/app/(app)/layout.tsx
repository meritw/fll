import { Header } from "@/components/header";
import { hasPasswordLogin } from "@/lib/accounts";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  const hasPassword = await hasPasswordLogin(session.user.id);

  return (
    <>
      <Header name={session.user.name} role={session.user.role} hasPassword={hasPassword} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</main>
    </>
  );
}
