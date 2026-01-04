"use client";

import React, { useRef, useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "user" | "assistant";
type Message = {
  id: string;
  role: Role;
  content: string;
};

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-2 top-2 z-10 rounded-md border border-border bg-muted/80 px-2 py-1 text-xs text-foreground hover:bg-muted"
        aria-label="Copy code"
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-sm leading-6">
        <code className="block">{code}</code>
      </pre>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-pre:m-0 prose-code:before:content-[''] prose-code:after:content-[''] text-foreground">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 text-2xl font-semibold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 text-xl font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 text-lg font-semibold">{children}</h3>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-1">
              {React.Children.map(children, (child, i) =>
                React.isValidElement(child)
                  ? React.cloneElement(child, {
                      key: child.key ?? `md-ul-${i}`,
                    })
                  : child
              )}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-1">
              {React.Children.map(children, (child, i) =>
                React.isValidElement(child)
                  ? React.cloneElement(child, {
                      key: child.key ?? `md-ol-${i}`,
                    })
                  : child
              )}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 text-primary"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-2 py-1 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1 align-top">
              {children}
            </td>
          ),
          code(props: any) {
            const { inline, className, children, ...rest } = props;
            const text = String(children ?? "");
            const match = /language-(\w+)/.exec(className || "");
            if (inline) {
              return (
                <code
                  className="rounded bg-muted px-1 py-0.5 text-sm"
                  {...rest}
                >
                  {text}
                </code>
              );
            }
            return <CodeBlock code={text} lang={match?.[1]} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatView({
  conversationId,
}: {
  conversationId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const key = "chat_session_id";
    let sid =
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (!sid) {
      sid = crypto.randomUUID();
      try {
        window.localStorage.setItem(key, sid);
      } catch {
        // ignore
      }
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    async function loadHistory() {
      if (!authenticated) return;
      try {
        if (conversationId) {
          const res = await fetch(
            `/api/conversations/${encodeURIComponent(conversationId)}`,
            {
              credentials: "include",
            }
          );
          if (!res.ok) return;
          const data = await res.json();
          setMessages(
            (data.messages || []).map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          );
          return;
        }

        if (!sessionId) return;
        const res = await fetch(
          `/api/chat?sessionId=${encodeURIComponent(sessionId)}`,
          {
            credentials: "include",
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        setMessages(
          (data.messages || []).map((m: any) => ({
            id: m.id ?? crypto.randomUUID(),
            role: m.role,
            content: m.content,
          }))
        );
      } catch {
        // ignore
      }
    }
    loadHistory();
  }, [sessionId, authenticated, conversationId]);

  async function handleSend(text: string) {
    if (!sessionId || !authenticated) return;

    const id = crypto.randomUUID();
    const userMsg: Message = { id, role: "user", content: text };
    const draftId = crypto.randomUUID();
    const assistantDraft: Message = {
      id: draftId,
      role: "assistant",
      content: "Thinking…",
    };

    setMessages((prev) => [...prev, userMsg, assistantDraft]);
    setError(null);
    setLoading(true);

    const maxRetries = 3;
    const baseDelay = 1000; // ms

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            sessionId,
            conversationId: conversationId ?? null,
          }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          let errMsg = txt || `Server error: ${res.status} ${res.statusText}`;
          try {
            const j = JSON.parse(txt || "{}");
            errMsg =
              j?.message || j?.error?.message || j?.body || JSON.stringify(j);
          } catch {
            // ignore
          }

          // If server suggests retry time, extract seconds
          let retrySeconds: number | null = null;
          try {
            const m = (errMsg || "").match(/retry in (\d+(?:\.\d+)?)s/i);
            if (m) retrySeconds = Number(m[1]);
          } catch {}

          if (attempt < maxRetries) {
            const delayMs = retrySeconds
              ? Math.ceil(retrySeconds * 1000)
              : baseDelay * Math.pow(2, attempt);
            setError(
              `Upstream error: ${errMsg}. Retrying in ${Math.ceil(
                delayMs / 1000
              )}s... (attempt ${attempt + 1}/${maxRetries})`
            );
            await new Promise((r) => setTimeout(r, delayMs));
            continue; // retry
          }

          // exhausted retries
          setMessages((prev) => prev.filter((m) => m.id !== assistantDraft.id));
          setError(errMsg);
          setLoading(false);
          return;
        }

        if (!res.body) {
          if (attempt < maxRetries) {
            const delayMs = baseDelay * Math.pow(2, attempt);
            setError(
              `No response body from server. Retrying in ${Math.ceil(
                delayMs / 1000
              )}s... (attempt ${attempt + 1}/${maxRetries})`
            );
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          setMessages((prev) => prev.filter((m) => m.id !== assistantDraft.id));
          setError("No response body from server.");
          setLoading(false);
          return;
        }

        const convoId = res.headers.get("x-conversation-id");
        try {
          if (convoId && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("conversation-created", {
                detail: { id: convoId },
              })
            );
          }
        } catch {}

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantDraft.id
                ? { ...m, content: acc || "Thinking…" }
                : m
            )
          );
        }

        // success: break retry loop
        break;
      } catch (e: any) {
        const attemptErr = String(e || "Error");
        if (attempt < maxRetries) {
          const delayMs = baseDelay * Math.pow(2, attempt);
          setError(
            `Network error: ${attemptErr}. Retrying in ${Math.ceil(
              delayMs / 1000
            )}s... (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        setMessages((prev) => prev.filter((m) => m.id !== assistantDraft.id));
        setError(`Network error: ${attemptErr}`);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col h-dvh max-w-2xl mx-auto px-4">
      <header className="py-6">
        <h1 className="text-2xl font-semibold text-pretty">Realtime Chat</h1>
        <p className="text-sm text-muted-foreground">Streaming responses</p>
      </header>

      {!authenticated && (
        <div className="p-4">
          <p className="mb-2">You must sign in with GitHub to use the chat.</p>
          <div className="flex gap-2">
            <button
              onClick={() => signIn("github")}
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground"
            >
              Sign in with GitHub
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto rounded-lg border border-border bg-card">
        <ol className="p-4 space-y-4">
          {messages.map((m, idx) => (
            <li key={m.id ?? `msg-${idx}`} className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              {m.role === "assistant" ? (
                <div className="leading-relaxed space-y-3">
                  <MarkdownRenderer content={m.content} />
                </div>
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </div>
              )}
            </li>
          ))}
          {error && (
            <li key="error" className="text-destructive">
              {error}
            </li>
          )}
        </ol>
      </main>

      <form
        ref={formRef}
        className="sticky bottom-0 flex items-center gap-2 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const text = String(fd.get("message") || "").trim();
          if (!text) return;
          handleSend(text);
          const input = e.currentTarget.elements.namedItem(
            "message"
          ) as HTMLInputElement | null;
          if (input) input.value = "";
        }}
      >
        <label htmlFor="message" className="sr-only">
          Message
        </label>
        <input
          id="message"
          name="message"
          placeholder="Type your message..."
          className="flex-1 h-11 px-3 rounded-md border border-input bg-background text-foreground"
          disabled={loading || !sessionId}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !sessionId}
          className="h-11 px-4 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="Send message"
          title="Send"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
