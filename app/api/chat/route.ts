export const maxDuration = 30;

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type StoredConversation = {
  messages: ClientMessage[];
  expiresAt: number;
};

const CONVO_TTL_MS = 60 * 60 * 1000; // 1 hour
const conversations = new Map<string, StoredConversation>();

function cleanupExpired() {
  const now = Date.now();
  for (const [k, v] of conversations) {
    if (v.expiresAt <= now) conversations.delete(k);
  }
}

export async function POST(req: Request) {
  try {
    let parsedBody: any;
    try {
      parsedBody = await req.json();
    } catch (e) {
      return new Response("Invalid JSON body", { status: 400 });
    }
    const {
      messages,
      sessionId,
      conversationId,
    }: {
      messages: ClientMessage[];
      sessionId?: string;
      conversationId?: string;
    } = parsedBody;

    // authenticate and get server session
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("../../../lib/auth");
    // debug: previously logged cookie header here
    const session: any = await getServerSession(authOptions as any);
    let userId: string | null = null;
    if (session?.user?.id) {
      userId = session.user.id as string;
    } else {
      // fallback: try to read next-auth session token cookie and lookup in DB
      try {
        const cookie = req.headers.get("cookie") || "";
        const m = cookie.match(/next-auth.session-token=([^;\s]+)/);
        const token = m ? decodeURIComponent(m[1]) : null;
        if (token) {
          const { prisma } = await import("../../../lib/prisma");
          const dbSession = await prisma.session.findUnique({
            where: { sessionToken: token },
          });
          if (dbSession) userId = dbSession.userId;
        }
      } catch (e) {
        console.error("session fallback error", e);
      }
    }

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    cleanupExpired();
    const sid = sessionId || crypto.randomUUID();

    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-2.5-flash";
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL;

    // Log masked key tail to verify which key is being used (safe-ish)
    try {
      if (apiKey) console.log("GEMINI_KEY_END=***" + apiKey.slice(-6));
    } catch {}

    if (!apiKey) {
      return new Response("Missing GEMINI_API_KEY", { status: 500 });
    }

    // Map client messages to Gemini "contents" format
    const contents = (messages || []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Persist conversation and latest user message to DB
    const { prisma } = await import("../../../lib/prisma");

    // If a conversationId was provided, load and validate ownership
    let conversation: any = null;
    if (conversationId) {
      conversation = await prisma.chatConversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation || conversation.userId !== userId) {
        return new Response("Conversation not found", { status: 404 });
      }
    } else {
      // upsert conversation by clientSessionId if provided, otherwise create
      if (sessionId) {
        conversation = await prisma.chatConversation.findUnique({
          where: { clientSessionId: sessionId },
        });
      }
      if (!conversation) {
        conversation = await prisma.chatConversation.create({
          data: {
            title: null,
            userId,
            clientSessionId: sessionId || sid,
          },
        });
      }
    }

    // store the last user message (optimistic: assume messages includes latest user msg at the end)
    const lastUserMsg = (messages || [])
      .filter((m: any) => m.role === "user")
      .slice(-1)[0];
    if (lastUserMsg && lastUserMsg.content) {
      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: lastUserMsg.content,
        },
      });
    }

    // Keep an in-memory store for quick session reads as well
    const toStore = (messages || []).filter(
      (m) => !(m.role === "assistant" && !m.content)
    );
    conversations.set(sid, {
      messages: toStore,
      expiresAt: Date.now() + CONVO_TTL_MS,
    });

    // ✅ Directly use one model (no loop)
    const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
      model
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    async function fetchWithRetries(
      input: RequestInfo,
      init: RequestInit & { signal?: AbortSignal },
      attempts = 3
    ): Promise<Response> {
      const baseDelay = 1000;
      for (let i = 0; i < attempts; i++) {
        const res = await fetch(input, init);
        if (res.ok && res.body) return res;

        // Only retry for rate limits or server overload
        if (res.status !== 429 && res.status !== 503) return res;

        // Try to find a recommended retry delay from body or headers
        let waitMs = baseDelay * Math.pow(2, i);
        try {
          const text = await res
            .clone()
            .text()
            .catch(() => "");
          try {
            const json = JSON.parse(text || "{}");
            const retryInfo = Array.isArray(json?.error?.details)
              ? json.error.details.find((d: any) =>
                  String(d["@type"] || "").includes("RetryInfo")
                )
              : undefined;
            const retryDelay = retryInfo?.retryDelay;
            if (typeof retryDelay === "string") {
              const m = retryDelay.match(/(\d+(?:\.\d+)?)s/);
              if (m) waitMs = Math.round(parseFloat(m[1]) * 1000);
            }
          } catch {}

          const ra = res.headers.get("retry-after");
          if (ra) {
            const raSec = parseInt(ra, 10);
            if (!isNaN(raSec)) waitMs = raSec * 1000;
          }
        } catch {}

        // Respect abort signal while waiting
        if (init.signal?.aborted) throw new Error("Request aborted");
        const jitter = Math.floor(Math.random() * 500);
        await new Promise<void>((resolve, reject) => {
          const to = setTimeout(resolve, waitMs + jitter);
          if (init.signal)
            init.signal.addEventListener(
              "abort",
              () => {
                clearTimeout(to);
                const ae: any = new Error("aborted");
                ae.name = "AbortError";
                reject(ae);
              },
              { once: true }
            );
        });
      }

      // Final attempt
      return fetch(input, init);
    }

    let upstream = await fetchWithRetries(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
        signal: req.signal,
      },
      3
    );

    console.log(upstream);

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      if (upstream.status === 429) {
        let retryMsg = "";
        let retrySeconds: number | null = null;
        try {
          const json = JSON.parse(errText || "{}");
          retryMsg = json?.error?.message || "";
          const retryInfo = Array.isArray(json?.error?.details)
            ? json.error.details.find((d: any) =>
                String(d["@type"] || "").includes("RetryInfo")
              )
            : undefined;
          const retryDelay = retryInfo?.retryDelay;
          if (typeof retryDelay === "string") {
            const m = retryDelay.match(/(\d+(?:\.\d+)?)s/);
            if (m) retrySeconds = Math.round(parseFloat(m[1]));
          }
        } catch {}
        const retryAfter = upstream.headers.get("retry-after") || "";
        if (!retrySeconds && retryAfter) {
          const ra = parseInt(retryAfter, 10);
          if (!isNaN(ra)) retrySeconds = ra;
        }

        // If a fallback model is configured, try it once
        if (fallbackModel && fallbackModel !== model) {
          console.log(
            `Upstream 429 on ${model}, trying fallback ${fallbackModel}`
          );
          const fallbackUrl = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
            fallbackModel
          )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

          const fallbackRes = await fetchWithRetries(
            fallbackUrl,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents }),
              signal: req.signal,
            },
            1
          );

          if (fallbackRes.ok && fallbackRes.body) {
            // swap upstream to fallback stream
            console.log(`Using fallback model ${fallbackModel}`);
            // replace upstream and continue to stream below
            // Note: we don't re-parse errText here
            (upstream as Response) = fallbackRes as unknown as Response;
          } else {
            const bodyMsg =
              retryMsg ||
              String(retryAfter) ||
              errText ||
              "Rate limit exceeded";
            const headers: Record<string, string> = {
              "Content-Type": "text/plain",
            };
            if (retrySeconds) headers["Retry-After"] = String(retrySeconds);
            return new Response(`Upstream rate limit: ${bodyMsg}`, {
              status: 429,
              headers,
            });
          }
        } else {
          const bodyMsg =
            retryMsg || String(retryAfter) || errText || "Rate limit exceeded";
          const headers: Record<string, string> = {
            "Content-Type": "text/plain",
          };
          if (retrySeconds) headers["Retry-After"] = String(retrySeconds);
          return new Response(`Upstream rate limit: ${bodyMsg}`, {
            status: 429,
            headers,
          });
        }
      }

      return new Response(
        `Upstream error: ${upstream.status} ${upstream.statusText}\n${errText}`,
        {
          status: 502,
        }
      );
    }

    // ✅ Parse SSE and stream text to client
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          // Match lines starting with data:
          const matches = [...chunk.matchAll(/data:\s*(\{.*\})/g)];
          for (const match of matches) {
            try {
              const json = JSON.parse(match[1]);
              const text =
                json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              if (text) {
                fullText += text;
                controller.enqueue(encoder.encode(text));
              }
            } catch {}
          }
        }

        controller.close();

        // Persist assistant final message to DB
        try {
          const { prisma } = await import("../../../lib/prisma");
          if (conversation && fullText) {
            await prisma.chatMessage.create({
              data: {
                conversationId: conversation.id,
                role: "assistant",
                content: fullText,
              },
            });
            // Also update the in-memory conversation store so GET /api/chat returns the assistant reply
            try {
              const existing = conversations.get(sid);
              const assistantMsg: ClientMessage = {
                role: "assistant",
                content: fullText,
              };
              if (existing) {
                existing.messages = existing.messages.concat([assistantMsg]);
                existing.expiresAt = Date.now() + CONVO_TTL_MS;
                conversations.set(sid, existing);
              } else {
                conversations.set(sid, {
                  messages: [assistantMsg],
                  expiresAt: Date.now() + CONVO_TTL_MS,
                });
              }
            } catch (e) {
              console.error("failed updating in-memory convo", e);
            }
          }
        } catch (e) {
          // log and continue; streaming already finished for client
          console.error("Failed to persist assistant message:", e);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-Conversation-Id": conversation?.id || "",
      },
    });
  } catch (err: any) {
    const isAbort =
      err?.name === "AbortError" || String(err).includes("aborted");
    if (isAbort) {
      return new Response("Request aborted", { status: 499 });
    }
    console.error("Error:", err);
    return new Response("Bad Request", { status: 400 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "missing sessionId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const convo = conversations.get(sessionId);
    const msgs = convo?.messages ?? [];

    return new Response(JSON.stringify({ messages: msgs }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GET /api/chat error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
