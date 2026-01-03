import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const { getServerSession } = await import("next-auth/next");
    const { authOptions } = await import("../../../lib/auth");
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    const userId = session.user.id as string;

    const body = await req.json().catch(() => ({}));
    const { title, clientSessionId } = body;

    const convo = await prisma.chatConversation.create({
      data: {
        title: title || null,
        userId,
        clientSessionId: clientSessionId || null,
      },
    });

    return new Response(JSON.stringify(convo), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(req: Request) {
  try {
    const { getServerSession } = await import("next-auth/next");
    const { authOptions } = await import("../../../lib/auth");
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    const userId = session.user.id as string;

    const convos = await prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return new Response(JSON.stringify(convos), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
