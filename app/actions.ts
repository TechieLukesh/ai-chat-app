import { prisma } from "../lib/prisma";

export async function getHistory(userId?: string) {
  const where = userId ? { where: { userId } } : {};
  const convos = await prisma.chatConversation.findMany({
    ...(where as object),
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return convos;
}
