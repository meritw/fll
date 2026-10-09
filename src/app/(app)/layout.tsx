import { Header } from "@/components/header";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <>
      <Header name={session.user.name} role={session.user.role} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-8">{children}</main>
    </>
  );
}
