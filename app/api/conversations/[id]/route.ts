import { prisma } from "../../../../lib/prisma";

async function getUserIdFromRequest(req: Request) {
  try {
    const { getServerSession } = await import("next-auth/next");
    const { authOptions } = await import("../../../lib/auth");
    const session: any = await getServerSession(authOptions as any);
    if (session?.user?.id) return session.user.id as string;
  } catch (e) {
    // fallthrough to cookie fallback
  }

  try {
    const cookie = req.headers.get("cookie") || "";
    const m = cookie.match(/next-auth.session-token=([^;\s]+)/);
    const token = m ? decodeURIComponent(m[1]) : null;
    if (token) {
      const { prisma } = await import("../../../../lib/prisma");
      const dbSession = await prisma.session.findUnique({
        where: { sessionToken: token },
      });
      if (dbSession) return dbSession.userId;
    }
  } catch (e) {
    console.error("session fallback error", e);
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id)
      return new Response(JSON.stringify({ error: "missing id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    const userId = await getUserIdFromRequest(req);
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    const convo = await prisma.chatConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!convo || convo.userId !== userId)
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

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    const body = await req.json().catch(() => ({}));
    const { title } = body;
    const { id } = params;

    const convo = await prisma.chatConversation.updateMany({
      where: { id, userId },
      data: { title: title ?? null },
    });
    if (convo.count === 0)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    const updated = await prisma.chatConversation.findUnique({ where: { id } });
    return new Response(JSON.stringify(updated), {
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

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    const { id } = params;
    const deleted = await prisma.chatConversation.deleteMany({
      where: { id, userId },
    });
    if (deleted.count === 0)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
