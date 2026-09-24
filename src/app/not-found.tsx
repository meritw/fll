import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-3xl font-semibold">That page is missing</h1>
      <Link href="/programs" className="text-lg underline-offset-4 hover:underline">
        Back to programs
      </Link>
    </main>
  );
}
