export interface SseClient {
  res: SseClientResponse;
}
export interface SseClientResponse {
  write: (data: string) => void;
  end: () => void;
  writableEnded: boolean;
}

export interface WebhookBodySSE {
  event: string;
  data: unknown;
}
