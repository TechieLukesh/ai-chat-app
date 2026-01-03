import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const { getServerSession } = await import("next-auth/next");
    const { authOptions } = await import("../../../lib/auth");
    const session: any = await getServerSession(authOptions as any);
    let userId: string | null = null;
    if (session?.user?.id) {
      userId = session.user.id as string;
    } else {
      // fallback: try to read next-auth session token cookie and lookup in DB
      try {
        const cookie = req.headers.get("cookie") || "";
        const m = cookie.match(/next-auth.session-token=([^;\s]+)/);
        const token = m ? decodeURIComponent(m[1]) : null;
        if (token) {
          const { prisma } = await import("../../../lib/prisma");
          const dbSession = await prisma.session.findUnique({
            where: { sessionToken: token },
          });
          if (dbSession) userId = dbSession.userId;
        }
      } catch (e) {
        console.error("session fallback error", e);
      }
    }
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

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
    let userId: string | null = null;
    if (session?.user?.id) {
      userId = session.user.id as string;
    } else {
      try {
        const cookie = req.headers.get("cookie") || "";
        const m = cookie.match(/next-auth.session-token=([^;\s]+)/);
        const token = m ? decodeURIComponent(m[1]) : null;
        if (token) {
          const { prisma } = await import("../../../lib/prisma");
          const dbSession = await prisma.session.findUnique({
            where: { sessionToken: token },
          });
          if (dbSession) userId = dbSession.userId;
        }
      } catch (e) {
        console.error("session fallback error", e);
      }
    }
    if (!userId)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

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
