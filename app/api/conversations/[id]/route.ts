import { prisma } from "../../../../lib/prisma";

export async function GET(req: Request) {
  try {
    const { getServerSession } = await import("next-auth/next");
    const { authOptions } = await import("../../../../lib/auth");
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    const userId = session.user.id as string;

    const { pathname } = new URL(req.url);
    const parts = pathname.split("/");
    const id = parts[parts.length - 1];
    if (!id)
      return new Response(JSON.stringify({ error: "missing id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    const convo = await prisma.chatConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!convo)
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    return new Response(JSON.stringify(convo), {
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

export async function DELETE(req: Request) {
  try {
    const { getServerSession } = await import("next-auth/next");
    const { authOptions } = await import("../../../../lib/auth");
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    const userId = session.user.id as string;

    const { pathname } = new URL(req.url);
    const parts = pathname.split("/");
    const id = parts[parts.length - 1];
    if (!id)
      return new Response(JSON.stringify({ error: "missing id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    const deleted = await prisma.chatConversation.deleteMany({ where: { id, userId } });
    if (deleted.count === 0)
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
