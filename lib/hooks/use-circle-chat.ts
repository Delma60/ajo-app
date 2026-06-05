"use client"

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useMutation } from "@tanstack/react-query";
import { db } from "@/lib/firebase/client";
import type { CircleChatMessage } from "@/lib/types/circle";

const circleMessagesCollection = collection(db, "circle_messages");

export function useCircleChat(circleId: string, enabled = true) {
  const [messages, setMessages] = useState<CircleChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!circleId || !enabled) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const messagesQuery = query(
      circleMessagesCollection,
      where("circleId", "==", circleId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const circleMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CircleChatMessage));
        setMessages(circleMessages);
        setIsLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [circleId, enabled]);

  return { messages, isLoading, error };
}

export function useSendCircleMessage() {
  return useMutation<{ id: string }, Error, { circleId: string; text: string }>({
    mutationFn: async (payload) => {
      const { circleId, text } = payload;
      if (!circleId) {
        throw new Error("Circle ID is required.");
      }

      if (!text.trim()) {
        throw new Error("Message text cannot be empty.");
      }

      const response = await fetch(`/api/circles/${circleId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Unable to send message");
      }

      return json.data;
    },
  });
}
