import { NextRequest } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat
 *
 * Server-side proxy to the gateway. The browser can't call the
 * gateway directly because the JWT sits in an HttpOnly cookie. We
 * read the cookie, attach it as Bearer, then pipe the SSE response
 * back to the client.
 *
 * Body: { messages: ChatMessage[], model?: string, stream?: boolean }
 */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = (await req.json().catch(() => ({}))) as {
    messages?: { role: string; content: string }[];
    model?: string;
    stream?: boolean;
  };

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const a = getAigarth();
  if (!a) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    if (body.stream !== false) {
      // Default: stream
      const stream = await a.chat.create({
        model: body.model ?? "aigarth-meridian-1",
        messages: body.messages as never,
        stream: true,
      });
      // Re-emit as SSE in the format the playground expects
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const delta = chunk.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
                );
              }
            }
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (err) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: (err as Error).message })}\n\n`,
              ),
            );
            controller.close();
          }
        },
      });
      return new Response(readable, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        },
      });
    } else {
      const completion = await a.chat.create({
        model: body.model ?? "aigarth-meridian-1",
        messages: body.messages as never,
      });
      return new Response(JSON.stringify(completion), {
        headers: { "content-type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
