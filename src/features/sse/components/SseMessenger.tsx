"use client";

import { useEffect, useState } from "react";

export const SseMessenger = () => {
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<string[]>([]);

  const handleSendMessage = async () => {
    // Use a "greeting" event name when broadcasting
    fetch("/api/webhooks/sse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "greeting",
        data: message,
      }),
    })
      .then(() => {
        setMessage("");
      })
      .catch((err) => {
        console.log(err);
      });
  };

  useEffect(() => {
    const evtSource = new EventSource("/api/sse");
    // Listen for the "greeting" named event
    evtSource.addEventListener("greeting", (event: MessageEvent) => {
      setMessages((prev) => [...prev, event.data as string]);
    });

    return () => {
      evtSource.close();
    };
  }, []);

  return (
    <div>
      <div>
        {messages.map((m, idx) => (
          <div key={idx}>{m}</div>
        ))}
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message"
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
};
