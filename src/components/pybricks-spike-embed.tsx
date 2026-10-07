"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const RS_BRIDGE_SOURCE = "rolling-sparks-pybricks";

type BridgeReady = {
  source: typeof RS_BRIDGE_SOURCE;
  type: "ready";
  version: number;
};

type BridgeExport = {
  source: typeof RS_BRIDGE_SOURCE;
  type: "export";
  requestId?: string;
  fileName: string;
  zipBase64: string;
  mimeType: string;
};

type BridgeExportError = {
  source: typeof RS_BRIDGE_SOURCE;
  type: "export-error";
  requestId?: string;
  message: string;
};

type BridgeMessage = BridgeReady | BridgeExport | BridgeExportError;

function isBridgeMessage(data: unknown): data is BridgeMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as { source?: string; type?: string };
  return msg.source === RS_BRIDGE_SOURCE && typeof msg.type === "string";
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Experimental same-origin embed of a self-hosted pybricks-code build.
 * Requires `public/pybricks` from `scripts/build-pybricks.sh`.
 */
export function PybricksSpikeEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const requestSeq = useRef(0);
  const statusId = useId();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Waiting for /pybricks iframe…");
  const [lastExport, setLastExport] = useState<{
    fileName: string;
    sizeBytes: number;
  } | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isBridgeMessage(event.data)) return;

      if (event.data.type === "ready") {
        setReady(true);
        setStatus(`Bridge ready (v${event.data.version}).`);
        return;
      }

      if (event.data.type === "export-error") {
        setStatus(`Export failed: ${event.data.message}`);
        return;
      }

      if (event.data.type === "export") {
        const blob = base64ToBlob(event.data.zipBase64, event.data.mimeType);
        setLastExport({ fileName: event.data.fileName, sizeBytes: blob.size });
        setStatus(
          `Received ${event.data.fileName} (${blob.size} bytes). Neon upload not wired in this spike.`,
        );
        // Prove we can get bytes into our process: offer a local download.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = event.data.fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const requestExport = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) {
      setStatus("Iframe not available.");
      return;
    }
    requestSeq.current += 1;
    const requestId = `req-${requestSeq.current}`;
    setStatus(`Requested export (${requestId})…`);
    frame.postMessage(
      { source: RS_BRIDGE_SOURCE, type: "export-request", requestId },
      window.location.origin,
    );
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3" aria-live="polite" id={statusId}>
        <Button type="button" size="xl" disabled={!ready} onClick={requestExport}>
          Request backup zip from iframe
        </Button>
        <p className="text-sm text-muted-foreground">{status}</p>
        {lastExport ? (
          <p className="text-sm">
            Last export: {lastExport.fileName} ({lastExport.sizeBytes} bytes)
          </p>
        ) : null}
      </div>
      <iframe
        ref={iframeRef}
        title="Pybricks Code (experimental self-host)"
        src="/pybricks/index.html"
        className="h-[min(70vh,720px)] w-full rounded-md border bg-background"
        // Same-origin: bluetooth/usb work with user gesture when served over HTTPS.
        allow="bluetooth; usb; serial; hid; clipboard-read; clipboard-write"
      />
      <p className="text-sm text-muted-foreground">
        Or open the SPA full-page at{" "}
        <a className="underline underline-offset-4" href="/pybricks/index.html">
          /pybricks/
        </a>{" "}
        (no X-Frame-Options on our static export).
      </p>
    </div>
  );
}
