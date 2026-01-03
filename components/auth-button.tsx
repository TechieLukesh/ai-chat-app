"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  if (loading) return null;

  if (!session) {
    return (
      <button
        onClick={() => signIn("github")}
        className="h-9 px-3 rounded-md bg-primary text-primary-foreground"
      >
        Sign in
      </button>
    );
  }

  const name = session.user?.name ?? session.user?.email ?? "User";

  async function handleSignOut() {
    try {
      // perform signOut without built-in redirect, then navigate and reload
      await signOut({ redirect: false });
      window.location.href = "/";
    } catch (e) {
      // fallback to default signOut behaviour
      signOut({ callbackUrl: "/" });
    }
  }

  return (
    <div className="flex items-center gap-2">
      {session.user?.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.user.image}
          alt={name}
          className="w-8 h-8 rounded-full"
        />
      )}
      <span className="text-sm">{name}</span>
      <button
        onClick={handleSignOut}
        className="h-9 px-3 rounded-md bg-destructive text-destructive-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
