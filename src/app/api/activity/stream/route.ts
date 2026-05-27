import { auth } from "@/lib/auth";
import { getActivitySince, getRecentActivity } from "@/lib/activity-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastSeen = new Date();

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const initial = await getRecentActivity(25);
        send("initial", { activities: initial });
        if (initial.length > 0) {
          lastSeen = new Date(initial[0].createdAt);
        }

        const interval = setInterval(async () => {
          try {
            const fresh = await getActivitySince(lastSeen, 20);
            if (fresh.length > 0) {
              lastSeen = new Date(fresh[0].createdAt);
              send("activities", { activities: fresh });
            }
            send("ping", { at: new Date().toISOString() });
          } catch {
            send("error", { message: "poll failed" });
          }
        }, 3000);

        request.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "stream failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
