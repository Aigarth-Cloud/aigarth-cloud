"use client";

/**
 * ExperienceStream — SSE consumer for the organism's per-experience
 * telemetry (Phase 26.D, Garden Organism view).
 *
 *   Connects to `/v1/organisms/:slug/experience-stream` (a
 *   text/event-stream endpoint in services/ann — NOT this
 *   wave's scope; it lands with the rest of the Work Runtime
 *   in Phase 27). If the endpoint returns 404, this component
 *   falls back to a "live updates coming soon" placeholder so
 *   the page does not 500.
 *
 *   The fallback is the documented contract for this Wave — see
 *   the prompt's "SSE pattern note" + ADR 005 §10 negative 1.
 *
 *   Why client-side?
 *     The EventSource API lives in the browser. The page is a
 *     server component; the SSE is isolated to this card.
 */

import * as React from "react";
import { Radio, AlertCircle } from "lucide-react";
import { Card, CardContent, Badge } from "@aigarth/ui";

interface ExperienceStreamProps {
  slug: string;
  /** Base URL for the ann service. Defaults to the localhost dev port. */
  endpoint?: string;
}

type StreamState =
  | { kind: "connecting" }
  | { kind: "live"; events: StreamEvent[] }
  | { kind: "fallback"; reason: string }
  | { kind: "error"; message: string };

interface StreamEvent {
  /** Event id, server-supplied. Used as the React key. */
  id: string;
  /** Event type: "snapshot" | "experience" | "end" — names mirror the training SSE. */
  type: string;
  /** JSON-decoded data payload. */
  data: unknown;
  /** Wall-clock time when the client received the event. */
  receivedAt: string;
}

const MAX_EVENTS = 25;

export function ExperienceStream({
  slug,
  endpoint,
}: ExperienceStreamProps) {
  const [state, setState] = React.useState<StreamState>({ kind: "connecting" });
  const sourceRef = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    // 1) Resolve the endpoint. The SDK normally hides this, but
    // we hit the ann service directly so the EventSource keeps
    // a single connection. Default to the dev port (7006) and
    // honour AIGARTH_ANN_URL when set in the browser env.
    const annBase =
      endpoint ??
      (typeof window !== "undefined"
        ? // The browser doesn't have process.env; check for a
          // window-level override set by the layout, else default.
          ((window as unknown as { __AIGARTH_ANN_URL?: string })
            .__AIGARTH_ANN_URL ?? "http://localhost:7006")
        : "http://localhost:7006");
    const url = `${annBase}/v1/organisms/${encodeURIComponent(slug)}/experience-stream`;

    // 2) Open the stream. EventSource auto-reconnects on
    // transient failures; we surface a one-time 404 as the
    // fallback path.
    let cancelled = false;
    let opened = false;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => {
      if (cancelled) return;
      opened = true;
    };

    source.onerror = () => {
      if (cancelled) return;
      // EventSource has fired onerror before any message — assume
      // the endpoint is not implemented yet and switch to the
      // documented fallback. Closing the source prevents it from
      // re-connecting every few seconds.
      try {
        source.close();
      } catch {
        /* already closed */
      }
      if (!opened) {
        setState({
          kind: "fallback",
          reason: "The live experience stream is not yet available.",
        });
      } else {
        setState({
          kind: "error",
          message: "Connection lost. Refresh to retry.",
        });
      }
    };

    // Generic message handler. The server emits three named events
    // ("snapshot", "experience", "end"); we treat all three
    // uniformly as a list entry, since the dashboard's purpose
    // is to show the latest per-experience telemetry.
    const handle = (e: MessageEvent) => {
      if (cancelled) return;
      let parsed: unknown = e.data;
      try {
        parsed = JSON.parse(e.data as string);
      } catch {
        /* not JSON — keep raw */
      }
      const evt: StreamEvent = {
        id: e.lastEventId || `${Date.now()}-${Math.random()}`,
        type: e.type || "message",
        data: parsed,
        receivedAt: new Date().toISOString(),
      };
      setState((prev) => {
        if (prev.kind === "live") {
          return {
            kind: "live",
            events: [evt, ...prev.events].slice(0, MAX_EVENTS),
          };
        }
        return { kind: "live", events: [evt] };
      });
    };
    source.addEventListener("snapshot", handle as EventListener);
    source.addEventListener("experience", handle as EventListener);
    source.addEventListener("end", handle as EventListener);
    source.onmessage = handle;

    return () => {
      cancelled = true;
      try {
        source.close();
      } catch {
        /* ignore */
      }
    };
  }, [slug, endpoint]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Radio className="h-4 w-4 text-garden-500" />
            Experience stream
          </h2>
          <StreamStateBadge state={state} />
        </div>

        {state.kind === "fallback" && (
          <div
            data-testid="experience-stream-fallback"
            className="mt-4 flex items-start gap-2 rounded-md border border-dashed bg-muted/40 p-3 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Live updates coming soon</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{state.reason}</p>
            </div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{state.message}</p>
          </div>
        )}

        {state.kind === "live" && (
          <ul
            data-testid="experience-stream-list"
            className="mt-4 max-h-56 space-y-1.5 overflow-y-auto text-xs"
          >
            {state.events.length === 0 ? (
              <li className="text-muted-foreground">Waiting for the first event…</li>
            ) : (
              state.events.map((evt) => (
                <li
                  key={evt.id}
                  className="flex items-baseline justify-between gap-2 rounded-md border bg-background/60 px-2 py-1.5"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {evt.type}
                  </span>
                  <span className="truncate font-mono">
                    {typeof evt.data === "string"
                      ? evt.data
                      : JSON.stringify(evt.data)}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}

        {state.kind === "connecting" && (
          <p className="mt-4 text-xs text-muted-foreground">Connecting…</p>
        )}
      </CardContent>
    </Card>
  );
}

function StreamStateBadge({ state }: { state: StreamState }) {
  if (state.kind === "live")
    return (
      <Badge variant="outline" className="text-[10px]">
        live
      </Badge>
    );
  if (state.kind === "connecting")
    return (
      <Badge variant="outline" className="text-[10px]">
        connecting
      </Badge>
    );
  if (state.kind === "fallback")
    return (
      <Badge variant="outline" className="text-[10px]">
        fallback
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] text-red-600">
      error
    </Badge>
  );
}
