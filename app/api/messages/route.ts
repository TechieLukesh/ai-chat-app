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
    const { conversationId, role, content } = body;
    if (!conversationId || !role || content === undefined) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ensure conversation belongs to user
    const convo = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
    if (!convo || convo.userId !== userId)
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });

    const msg = await prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    return new Response(JSON.stringify(msg), {
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

export async function DELETE(req: Request) {
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

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id)
      return new Response(JSON.stringify({ error: "missing id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    // Ensure message belongs to a conversation owned by user
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return new Response(null, { status: 204 });
    const convo = await prisma.chatConversation.findUnique({ where: { id: msg.conversationId } });
    if (!convo || convo.userId !== userId)
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

    await prisma.chatMessage.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
