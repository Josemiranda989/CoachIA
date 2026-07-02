/**
 * OpenCode Go API helper — usa node:https directamente para evitar
 * el bug UND_ERR_HEADERS_TIMEOUT de undici (fetch nativo de Node).
 *
 * Endpoint: https://opencode.ai/zen/go/v1 (formato OpenAI-compatible)
 */

import https from "node:https";

const BASE_URL = "https://opencode.ai/zen/go/v1";
const DEFAULT_MODEL = "deepseek-v4-flash";
const MONTHLY_MODEL = "kimi-k2.6";

interface OpenCodeMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenCodeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "json_object" | "text";
  timeout?: number;
}

function openCodeRequest(
  body: string,
  options: OpenCodeOptions,
): Promise<string> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) throw new Error("OPENCODE_API_KEY no configurada");

  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}/chat/completions`);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: options.timeout ?? 300_000,
        family: 4, // evitar IPv6 ENETUNREACH
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.message?.content ?? "";
              resolve(content);
            } catch {
              reject(
                new Error(
                  `OpenCode JSON inválido (HTTP ${res.statusCode}): ${data.slice(0, 300)}`,
                ),
              );
            }
          } else {
            reject(
              new Error(
                `OpenCode HTTP ${res.statusCode}: ${data.slice(0, 300)}`,
              ),
            );
          }
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("OpenCode request timed out"));
    });

    req.write(body);
    req.end();
  });
}

function buildMessages(
  messages: OpenCodeMessage[],
  options: OpenCodeOptions,
): string {
  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_MODEL,
    messages,
    max_tokens: options.maxTokens ?? 16_384,
    temperature: options.temperature ?? 0.7,
  };

  if (options.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  return JSON.stringify(body);
}

export async function openCodeChat(
  messages: OpenCodeMessage[],
  options: OpenCodeOptions = {},
): Promise<string> {
  const body = buildMessages(messages, options);
  return openCodeRequest(body, options);
}

/**
 * Versión para generate-monthly (usa deepseek-v4-pro para tarea pesada).
 */
export async function openCodeMonthlyChat(
  messages: OpenCodeMessage[],
  options: OpenCodeOptions = {},
): Promise<string> {
  return openCodeChat(messages, {
    ...options,
    model: options.model ?? MONTHLY_MODEL,
    maxTokens: options.maxTokens ?? 65_536,
    timeout: options.timeout ?? 600_000,
    responseFormat: "json_object",
  });
}

/**
 * Versión para generate semanal (usa deepseek-v4-flash).
 */
export async function openCodeWeeklyChat(
  messages: OpenCodeMessage[],
  options: OpenCodeOptions = {},
): Promise<string> {
  return openCodeChat(messages, {
    ...options,
    model: options.model ?? DEFAULT_MODEL,
    maxTokens: options.maxTokens ?? 16_384,
    timeout: options.timeout ?? 120_000,
    responseFormat: "json_object",
  });
}

// ---------------------------------------------------------------------------
// Tool calling — para el chat de adaptación de rutina en caliente (ADR-001).
// El cliente existente (openCodeRequest) descarta todo menos message.content,
// así que acá se agrega una variante que devuelve la message completa con
// tool_calls. Es aditivo: no toca el camino de generación mensual/semanal.
// ---------------------------------------------------------------------------

export interface OpenCodeToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenCodeChatResult {
  content: string;
  toolCalls: OpenCodeToolCall[];
}

function openCodeRequestRaw(
  body: string,
  timeout?: number,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) throw new Error("OPENCODE_API_KEY no configurada");

  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}/chat/completions`);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeout ?? 120_000,
        family: 4,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(
                new Error(
                  `OpenCode JSON inválido (HTTP ${res.statusCode}): ${data.slice(0, 300)}`,
                ),
              );
            }
          } else {
            reject(
              new Error(`OpenCode HTTP ${res.statusCode}: ${data.slice(0, 300)}`),
            );
          }
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("OpenCode request timed out"));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Chat con tool calling. Devuelve content + tool_calls crudas (formato OpenAI);
 * el caller valida los arguments con Zod antes de aplicarlos a la DB.
 */
export async function openCodeChatWithTools(
  messages: Array<Record<string, unknown>>,
  tools: Array<Record<string, unknown>>,
  options: OpenCodeOptions & {
    toolChoice?: "auto" | "none" | "required";
  } = {},
): Promise<OpenCodeChatResult> {
  const body = JSON.stringify({
    model: options.model ?? DEFAULT_MODEL,
    messages,
    tools,
    tool_choice: options.toolChoice ?? "auto",
    max_tokens: options.maxTokens ?? 4_096,
    temperature: options.temperature ?? 0.4,
  });

  const parsed = await openCodeRequestRaw(body, options.timeout ?? 120_000);
  const choices = parsed.choices as
    | Array<{ message?: { content?: string; tool_calls?: OpenCodeToolCall[] } }>
    | undefined;
  const message = choices?.[0]?.message ?? {};

  return {
    content: message.content ?? "",
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
  };
}
