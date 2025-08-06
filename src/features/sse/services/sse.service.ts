import { EventEmitter } from "events";
import { logger } from "@/utils/logging";
import type { SseClient } from "../types";

// Extend global namespace to store the singleton
declare global {
  var __sseService: SseService | undefined;
}

class SseService extends EventEmitter {
  private clients = new Map<string, SseClient>();
  private static readonly TAG = "SseService";
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    logger.info(SseService.TAG, "SseService instance created/reused");
    this.initHeartbeat();
  }

  private initHeartbeat() {
    // Clear existing interval if any
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      logger.debug(
        SseService.TAG,
        `Heartbeat check - clients count: ${this.clients.size}`,
      );

      this.clients.forEach((client, userId) => {
        if (client.res.writableEnded) {
          logger.info(
            SseService.TAG,
            `Client for user ${userId} disconnected, removing from pool`,
          );
          this.removeClient(userId);
        } else {
          try {
            client.res.write(":heartbeat\n\n");
          } catch (error) {
            logger.error(
              SseService.TAG,
              `Error writing heartbeat to user ${userId}:`,
              error,
            );
            this.removeClient(userId);
          }
        }
      });
    }, 10000);
  }

  addClient(userId: string, client: SseClient) {
    this.clients.set(userId, client);
    logger.info(
      SseService.TAG,
      `Client added for user ${userId}. Total clients: ${this.clients.size}`,
    );
    this.emit("clientAdded", userId);
  }

  removeClient(userId: string) {
    const client = this.clients.get(userId);
    if (client) {
      try {
        if (!client.res.writableEnded) {
          client.res.end();
        }
      } catch (error) {
        logger.warn(
          SseService.TAG,
          `Error ending response for user ${userId}:`,
          error,
        );
      }
      this.clients.delete(userId);
      logger.info(
        SseService.TAG,
        `Client removed for user ${userId}. Remaining clients: ${this.clients.size}`,
      );
      this.emit("clientRemoved", userId);
    }
  }

  sendToUser(userId: string, data: unknown, eventName?: string): boolean {
    const client = this.clients.get(userId);
    if (client) {
      try {
        let payload = "";
        if (eventName) {
          payload += `event: ${eventName}\n`;
        }
        payload += `data: ${JSON.stringify(data)}\n\n`;
        client.res.write(payload);
        logger.info(
          SseService.TAG,
          `Sent message to user ${userId}${eventName ? " (event: " + eventName + ")" : ""}`,
        );
        return true;
      } catch (error) {
        logger.error(
          SseService.TAG,
          `Error sending message to user ${userId}:`,
          error,
        );
        this.removeClient(userId);
        return false;
      }
    }
    logger.warn(SseService.TAG, `No client found for user ${userId}`);
    return false;
  }

  broadcast(data: unknown, eventName?: string) {
    logger.info(
      SseService.TAG,
      `Broadcasting message to all clients${eventName ? " (event: " + eventName + ")" : ""}`,
    );
    logger.info(SseService.TAG, `Clients count: ${this.clients.size}`);

    if (this.clients.size === 0) {
      logger.warn(SseService.TAG, "No clients to broadcast to");
      return;
    }

    // Create array to avoid concurrent modification issues
    const clientEntries = Array.from(this.clients.entries());

    clientEntries.forEach(([userId, _client]) => {
      this.sendToUser(userId, data, eventName);
    });
  }

  // Get current client count for debugging
  getClientCount(): number {
    return this.clients.size;
  }

  // Get all connected user IDs for debugging
  getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  getClients(): Map<string, SseClient> {
    return this.clients;
  }

  // Cleanup method
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client, userId) => {
      try {
        if (!client.res.writableEnded) {
          client.res.end();
        }
      } catch (error) {
        logger.warn(
          SseService.TAG,
          `Error closing connection for user ${userId}:`,
          error,
        );
      }
    });

    this.clients.clear();
    this.removeAllListeners();
  }
}

function getSseService(): SseService {
  if (!globalThis.__sseService) {
    globalThis.__sseService = new SseService();

    process.on("SIGINT", () => {
      if (globalThis.__sseService) {
        globalThis.__sseService.cleanup();
      }
    });

    process.on("SIGTERM", () => {
      if (globalThis.__sseService) {
        globalThis.__sseService.cleanup();
      }
    });
  }

  return globalThis.__sseService;
}

export const sseService = getSseService();
