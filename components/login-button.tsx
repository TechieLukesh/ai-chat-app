"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, User } from "lucide-react";

export default function LoginButton() {
  const { data: session } = useSession();

  if (session && session.user) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <User size={16} />
          <span className="truncate">{session.user.name}</span>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-200 px-3 py-2 rounded-md text-sm transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("github")}
      className="w-full flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm transition-colors"
    >
      <LogIn size={16} />
      Sign in with GitHub
    </button>
  );
}
