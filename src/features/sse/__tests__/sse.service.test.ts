import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { type SseClientResponse } from "../types";
import type { sseService as SseServiceType } from "../services/sse.service";

let sseService: typeof SseServiceType;

class MockResponse implements SseClientResponse {
  data = "";
  ended = false;
  writableEnded = false;

  write(chunk: string) {
    this.data += chunk;
  }

  end() {
    this.ended = true;
    this.writableEnded = true;
  }
}

vi.mock("@/utils/logging", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SseService", () => {
  let mockRes: MockResponse;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const { sseService: service } = await import("../services/sse.service");
    sseService = service;

    mockRes = new MockResponse();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should add a client", () => {
    sseService.addClient("user1", { res: mockRes });
    expect(sseService.getClients().has("user1")).toBe(true);
    expect(sseService.getClients().get("user1")?.res).toBe(mockRes);
  });

  it("should remove a client", () => {
    sseService.addClient("user1", { res: mockRes });
    sseService.removeClient("user1");
    expect(sseService.getClients().has("user1")).toBe(false);
    expect(mockRes.ended).toBe(true);
  });

  it("should send a message to a specific user (default event)", () => {
    sseService.addClient("user1", { res: mockRes });
    const data = { message: "Hello" };
    sseService.sendToUser("user1", data);
    expect(mockRes.data).toBe(`data: ${JSON.stringify(data)}\n\n`);
  });

  it("should send a named event to a specific user", () => {
    sseService.addClient("user1", { res: mockRes });
    const data = { message: "Named Hello" };
    sseService.sendToUser("user1", data, "greeting");
    // The data should include the event field
    expect(mockRes.data).toBe(
      `event: greeting\ndata: ${JSON.stringify(data)}\n\n`,
    );
  });

  it("should broadcast a message to all clients (default event)", () => {
    const mockRes2 = new MockResponse();
    sseService.addClient("user1", { res: mockRes });
    sseService.addClient("user2", { res: mockRes2 });

    const data = { message: "Broadcast" };
    sseService.broadcast(data);

    expect(mockRes.data).toBe(`data: ${JSON.stringify(data)}\n\n`);
    expect(mockRes2.data).toBe(`data: ${JSON.stringify(data)}\n\n`);
  });

  it("should broadcast a named event to all clients", () => {
    const mockRes2 = new MockResponse();
    sseService.addClient("user1", { res: mockRes });
    sseService.addClient("user2", { res: mockRes2 });

    const data = { message: "Named Broadcast" };
    sseService.broadcast(data, "announcement");

    expect(mockRes.data).toBe(
      `event: announcement\ndata: ${JSON.stringify(data)}\n\n`,
    );
    expect(mockRes2.data).toBe(
      `event: announcement\ndata: ${JSON.stringify(data)}\n\n`,
    );
  });

  it("should send heartbeat messages", () => {
    sseService.addClient("user1", { res: mockRes });
    vi.advanceTimersByTime(10000);
    expect(mockRes.data).toBe(`:heartbeat\n\n`);
  });

  it("should remove disconnected clients during heartbeat", () => {
    mockRes.writableEnded = true;
    sseService.addClient("user1", { res: mockRes });

    expect(sseService.getClients().has("user1")).toBe(true);

    vi.advanceTimersByTime(10000);

    expect(sseService.getClients().has("user1")).toBe(false);
  });
});
