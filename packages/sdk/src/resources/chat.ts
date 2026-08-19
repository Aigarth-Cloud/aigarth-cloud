import { BaseResource } from "./_base.js";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "../types/chat.js";

/**
 * /v1/chat/completions — OpenAI-compatible chat completions.
 *
 *   const completion = await client.chat.completions.create({
 *     model: "aigarth-meridian-1",
 *     messages: [{ role: "user", content: "Hello!" }],
 *   });
 *
 * Streaming returns an async iterable of ChatCompletionChunk:
 *
 *   const stream = await client.chat.completions.create({
 *     model: "...",
 *     messages: [...],
 *     stream: true,
 *   });
 *   for await (const chunk of stream) {
 *     process.stdout.write(chunk.choices[0]?.delta.content ?? "");
 *   }
 */
export class ChatCompletions extends BaseResource {
  /**
   * Create a chat completion.
   *
   * If `stream: true` is set, the response is parsed as an SSE stream
   * and returned as an async iterable. Otherwise, it returns a single
   * ChatCompletion object.
   */
  async create(
    params: ChatCompletionCreateParams & { stream: true },
  ): Promise<AsyncIterable<ChatCompletionChunk>>;
  async create(
    params: ChatCompletionCreateParams & { stream?: false | null },
  ): Promise<ChatCompletion>;
  async create(
    params: ChatCompletionCreateParams,
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> {
    if (params.stream) {
      return this.streamCompletion(params);
    }
    return this.request<ChatCompletion>("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  private async streamCompletion(
    params: ChatCompletionCreateParams,
  ): Promise<AsyncIterable<ChatCompletionChunk>> {
    const direct = await this.streamDirect(params);
    return parseSse(direct);
  }

  private async streamDirect(params: ChatCompletionCreateParams): Promise<Response> {
    const url = `${this.baseURL}/v1/chat/completions`;
    const headers = new Headers();
    headers.set("authorization", `Bearer ${this.client.apiKey}`);
    headers.set("content-type", "application/json");
    headers.set("accept", "text/event-stream");
    headers.set("user-agent", "@aigarth/sdk/0.2.0");
    if (this.client.organization) headers.set("aigarth-organization", this.client.organization);
    if (this.client.project) headers.set("aigarth-project", this.client.project);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      throw new Error(`Stream request failed: ${response.status} ${body}`);
    }
    return response;
  }
}

async function* parseSse(response: Response): AsyncIterable<ChatCompletionChunk> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by a blank line (\n\n)
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of raw.split("\n")) {
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (data === "[DONE]") return;
            try {
              yield JSON.parse(data) as ChatCompletionChunk;
            } catch {
              // skip malformed
            }
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}
