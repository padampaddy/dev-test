import { sseService, type SseClient } from "@/features/sse";
import { logger } from "@/utils/logging";
import type { NextRequest } from "next/server";
import { getSession } from "@/features/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Sets up streaming response, following the OpenAI reference pattern
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Set up SSE client to use the writer API, if needed
  const client: SseClient = {
    res: {
      writableEnded: false,
      write: (data: string) => {
        try {
          void writer.write(encoder.encode(data));
        } catch (e: unknown) {
          logger.error("Error writing to SSE stream", String(e));
        }
      },
      end: () => {
        try {
          void writer.close();
        } catch {
          // Ignore error
        }
      },
    },
  };

  sseService.addClient(userId, client);
  sseService.sendToUser(userId, "Hi");
  // This will end/cleanup the stream if the HTTP connection is aborted
  req.signal.addEventListener("abort", () => {
    sseService.removeClient(userId);
    try {
      void writer.close();
    } catch {
      /* Ignore */
    }
  });

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
