import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSession, needsPasswordChange } from "@/lib/session";

export const metadata: Metadata = {
  title: {
    absolute: "Rolling Sparks · FLL Team 55900 · Penfield",
  },
  description:
    "Education site for Rolling Sparks, FIRST LEGO League Challenge team 55900 from Penfield Central School District. Team robot programs, meeting notes, engineering notebook, and learning resources.",
  robots: {
    index: true,
    follow: true,
  },
  keywords: [
    "FIRST LEGO League",
    "FLL",
    "FLL Challenge",
    "Rolling Sparks",
    "team 55900",
    "Penfield Central School District",
    "STEM education",
    "robotics",
  ],
};

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(needsPasswordChange(session.user) ? "/set-password" : "/home");
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.04_55)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.985_0.006_95)_0%,_oklch(0.97_0.01_70)_100%)]"
      />

      <header className="border-b border-border/70 bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <p className="text-xl font-semibold tracking-tight sm:text-2xl">Rolling Sparks</p>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Team sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-12 sm:py-16">
        <section className="max-w-3xl">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            FIRST LEGO League Challenge · Team 55900
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Rolling Sparks
          </h1>
          <p className="mt-3 text-xl text-muted-foreground">
            Penfield Central School District
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/90">
            This is the team website for Rolling Sparks, an educational FIRST LEGO
            League Challenge robotics team. Members use it for Spike Prime robot
            programs, meeting notes and engineering notebook work, and shared team
            learning resources.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="xl">
              <Link href="/login">Sign in to team workspace</Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <a
                href="https://www.firstinspires.org/programs/fll/"
                rel="noopener noreferrer"
                target="_blank"
              >
                About FLL Challenge
              </a>
            </Button>
          </div>
        </section>

        <section className="mt-14 max-w-3xl border-t border-border/80 pt-10">
          <h2 className="text-2xl font-semibold tracking-tight">What you&apos;ll find here</h2>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            After signing in, teammates can open robot program files, review meeting
            and journal notes for the engineering notebook, and use other team tools.
            The public pages on this site explain who we are; student work and
            account access stay behind sign-in.
          </p>
        </section>

        <section className="mt-12 max-w-3xl border-t border-border/80 pt-10">
          <h2 className="text-2xl font-semibold tracking-tight">About FIRST and FLL</h2>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            <a
              className="font-medium text-foreground underline-offset-4 hover:underline"
              href="https://www.firstinspires.org/"
              rel="noopener noreferrer"
              target="_blank"
            >
              FIRST
            </a>{" "}
            (For Inspiration and Recognition of Science and Technology) runs youth
            STEM programs worldwide.{" "}
            <a
              className="font-medium text-foreground underline-offset-4 hover:underline"
              href="https://www.firstinspires.org/programs/fll/"
              rel="noopener noreferrer"
              target="_blank"
            >
              FIRST LEGO League Challenge
            </a>{" "}
            invites students to research real-world themes, design an innovation
            project, and program a LEGO Education SPIKE Prime robot for a mission-based
            robot game—building teamwork, coding, and engineering skills in a school
            and community setting.
          </p>
          <ul className="mt-5 list-disc space-y-2 pl-6 text-lg text-muted-foreground">
            <li>
              <a
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href="https://www.firstinspires.org/"
                rel="noopener noreferrer"
                target="_blank"
              >
                FIRST Inspires
              </a>
              {" — "}
              official FIRST organization site
            </li>
            <li>
              <a
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href="https://www.firstinspires.org/programs/fll/"
                rel="noopener noreferrer"
                target="_blank"
              >
                FIRST LEGO League
              </a>
              {" — "}
              Discover, Explore, and Challenge programs
            </li>
          </ul>
        </section>

        <section className="mt-12 max-w-3xl border-t border-border/80 pt-10 pb-4">
          <h2 className="text-2xl font-semibold tracking-tight">Team details</h2>
          <dl className="mt-4 grid gap-3 text-lg sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium text-foreground">Team name</dt>
            <dd className="text-muted-foreground">Rolling Sparks</dd>
            <dt className="font-medium text-foreground">FLL team #</dt>
            <dd className="text-muted-foreground">55900</dd>
            <dt className="font-medium text-foreground">Affiliation</dt>
            <dd className="text-muted-foreground">Penfield Central School District</dd>
            <dt className="font-medium text-foreground">Program</dt>
            <dd className="text-muted-foreground">FIRST LEGO League Challenge</dd>
          </dl>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-card/50">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Rolling Sparks · FLL Challenge team 55900 · Penfield CSD</p>
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/login">
            Team sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
