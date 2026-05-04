import https from "node:https";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Uses node:https instead of fetch/undici: Node 18+ fetch intermittently
// hangs with ETIMEDOUT when handshaking against api.telegram.org from inside
// Docker on Windows, while plain https/wget work fine. node:https sidesteps
// the undici issue and keeps Telegram notifications reliable.
function postJson(
  host: string,
  path: string,
  body: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        host,
        path,
        port: 443,
        family: 4,
        timeout: 10_000,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("telegram request timeout"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram not configured: missing BOT_TOKEN or CHAT_ID");
    return false;
  }

  const body = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
  });

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await postJson(
        "api.telegram.org",
        `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        body
      );
      if (res.status >= 200 && res.status < 300) return true;
      console.error("Telegram send error:", res.status, res.body.slice(0, 200));
      return false;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  console.error("Telegram send failed after retry:", lastErr);
  return false;
}
