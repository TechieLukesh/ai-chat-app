"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

type Conversation = {
  id: string;
  title?: string | null;
  createdAt?: string;
};

export default function ConversationsSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (status !== "authenticated") return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/conversations", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!mounted) return;
        setConvos(data || []);
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    function onCreated(e: any) {
      try {
        const id = e?.detail?.id;
        if (!id) return;
        setConvos((s) => {
          if (s.find((c) => c.id === id)) return s;
          const now = new Date().toISOString();
          return [{ id, title: null, createdAt: now }, ...s];
        });
      } catch {}
    }
    window.addEventListener("conversation-created", onCreated);

    return () => {
      mounted = false;
      window.removeEventListener("conversation-created", onCreated);
    };
  }, [status]);

  const activeId = (() => {
    const m = pathname?.match(/\/chat\/(.+)$/);
    return m ? m[1] : null;
  })();

  async function handleNew() {
    if (status !== "authenticated") return signIn("github");
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const convo = await res.json();

      // optimistic update
      setConvos((s) => [convo, ...s]);
      router.push(`/chat/${convo.id}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string, currentTitle?: string | null) {
    if (status !== "authenticated") return signIn("github");
    const newTitle = prompt("Rename conversation", currentTitle || "");
    if (newTitle === null) return; // cancelled
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setConvos((s) =>
        s.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
      );
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this conversation?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setConvos((s) => s.filter((c) => c.id !== id));
      // if currently viewing the deleted convo, navigate to root
      if (activeId === id) router.push("/chat");
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  return (
    <aside className="w-80 min-h-screen p-3 bg-card border-r border-border fixed left-0 top-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold">Chats</h3>
          <div className="mt-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full text-sm px-2 py-1 rounded border border-input bg-background"
            />
          </div>
        </div>
        <div className="ml-2">
          <button
            onClick={handleNew}
            disabled={creating || status !== "authenticated"}
            className={`text-sm px-2 py-1 rounded ${
              status === "authenticated"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            aria-label={
              status === "authenticated" ? "New chat" : "Sign in to create chat"
            }
            title={
              status === "authenticated" ? "New chat" : "Sign in to create chat"
            }
          >
            {status === "authenticated" ? "New" : "Sign in to create"}
          </button>
        </div>
      </div>

      {status === "loading" ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : status !== "authenticated" ? (
        <div className="p-2">
          <p className="text-sm mb-2">Sign in to view your conversations.</p>
          <div className="flex gap-2">
            <button
              onClick={() => signIn("github")}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground"
            >
              Sign in with GitHub
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : convos.length === 0 ? (
        <div className="text-sm text-muted-foreground">No conversations</div>
      ) : (
        <ul className="space-y-2">
          {convos
            .filter((c) =>
              (c.title || "").toLowerCase().includes(query.toLowerCase())
            )
            .map((c) => {
              const title = c.title || "New Chat";
              const isActive = c.id === activeId;
              return (
                <li
                  key={c.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    isActive ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <div
                    className="flex-1 truncate"
                    onClick={() => router.push(`/chat/${c.id}`)}
                  >
                    <div className="font-medium truncate">{title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleString()
                        : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRename(c.id, c.title)}
                      className="text-sm px-2 py-1 rounded bg-foreground/5"
                      aria-label={`Rename conversation ${title}`}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="ml-2 text-sm text-destructive px-2 py-1 rounded"
                      aria-label={`Delete conversation ${title}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      {error && <div className="mt-4 text-sm text-destructive">{error}</div>}
    </aside>
  );
}
