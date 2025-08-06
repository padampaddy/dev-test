import type { NextRequest } from "next/server";
import { sseService } from "@/features/sse";
import type { WebhookBodySSE } from "../types";
import { logger } from "@/utils/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { event, data } = (await request.json()) as WebhookBodySSE;
  logger.info("Event", event);
  logger.info("Data", String(data));
  // Broadcast to all SSE clients
  sseService.broadcast(data, event);

  return new Response("Broadcasted", { status: 200 });
}
