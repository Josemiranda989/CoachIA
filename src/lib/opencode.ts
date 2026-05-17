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
