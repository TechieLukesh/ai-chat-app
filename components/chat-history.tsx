import Link from "next/link";
import { getHistory } from "../app/actions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/auth";

export default async function ChatHistory() {
  const session: any = await getServerSession(authOptions as any);
  const userId = session?.user?.id as string | undefined;
  const chats = await getHistory(userId);

  return (
    <div className="flex flex-col gap-2 p-2">
      <h2 className="px-2 text-xs font-semibold text-gray-500 uppercase">
        History
      </h2>

      {chats.length === 0 ? (
        <p className="text-sm text-gray-400 px-2">No previous chats</p>
      ) : (
        <div className="flex flex-col gap-1">
          {chats.map((chat: any) => {
            const title =
              chat.messages?.[0]?.content?.substring(0, 30) + "..." ||
              `Chat ${new Date(chat.createdAt).toLocaleDateString()}`;
            return (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 truncate transition-colors"
              >
                {title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
