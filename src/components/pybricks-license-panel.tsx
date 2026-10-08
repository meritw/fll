"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PYBRICKS_CODE_URL = "https://code.pybricks.com";

type Props = {
  code: string | null;
  isCoachReserved: boolean;
  viewerName: string;
};

export function PybricksLicensePanel({ code, isCoachReserved, viewerName }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  if (!code) {
    return (
      <Card className="text-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Your Pybricks block-coding code</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-base leading-relaxed">
          <p>
            Hi {viewerName}. You do not have a block-coding license seat yet. Ask a coach to
            add your account (or free up a seat), then refresh this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="text-lg">
      <CardHeader>
        <CardTitle className="text-2xl">
          {isCoachReserved ? "Coach Pybricks license (Bob)" : "Your Pybricks block-coding code"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-base leading-relaxed">
        <p>
          This code unlocks <strong>block coding</strong> in Pybricks. It is only for{" "}
          <strong>{viewerName}</strong>
          {isCoachReserved ? " (coach seat)" : ""}. Do not share it with other kids.
        </p>

        <div className="rounded-xl bg-muted/60 p-4 ring-1 ring-foreground/10">
          <p className="mb-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Your license code
          </p>
          <p className="break-all font-mono text-base leading-snug sm:text-lg">{code}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" size="xl" onClick={copyCode}>
              {copied ? "Copied!" : "Copy code"}
            </Button>
            <Button asChild size="xl" variant="outline">
              <a href={PYBRICKS_CODE_URL} target="_blank" rel="noopener noreferrer">
                Open Pybricks
              </a>
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold">How to unlock blocks in Pybricks</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6">
            <li>
              Go to{" "}
              <a
                className="font-medium underline-offset-4 hover:underline"
                href={PYBRICKS_CODE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                code.pybricks.com
              </a>
              .
            </li>
            <li>
              Click the <strong>user icon</strong> in the <strong>top right</strong> corner
              (or start a new <strong>Block coding</strong> program — Pybricks will ask you to
              sign in).
            </li>
            <li>
              In the login dialog, <strong>paste or type your license code</strong> (use Copy
              code above).
            </li>
            <li>
              Click <strong>Activate</strong>.
            </li>
            <li>
              You can check your license anytime by clicking the same user icon again. To move
              the license to another device, click <strong>Deactivate</strong> there first, then
              Activate on the new device.
            </li>
          </ol>
          <p className="mt-4 text-muted-foreground">
            Tip: Coding with Python is free. Block coding needs this license.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
