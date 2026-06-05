"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  useCircleChat,
  useSendCircleMessage,
} from "@/lib/hooks/use-circle-chat";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CircleWithGoal } from "@/lib/types/circle";

interface CircleChatProps {
  circle: CircleWithGoal;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function formatTime(value: any) {
  const date = value?.toDate?.() ?? new Date(value ?? Date.now());
  return date.toLocaleString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CircleChat({ circle }: CircleChatProps) {
  const appUser = useAuthStore((state) => state.appUser);
  const isMember = circle.memberIds.includes(appUser?.id ?? "");
  const { messages, isLoading, error } = useCircleChat(circle.id, isMember);
  const sendMessage = useSendCircleMessage();
  const [draft, setDraft] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const messageCountText = useMemo(
    () =>
      messages.length === 0
        ? "No messages yet."
        : `${messages.length} messages`,
    [messages.length],
  );

  const isSending = sendMessage.isPending;

  async function handleSend() {
    if (!draft.trim() || !circle.id) {
      return;
    }

    try {
      await sendMessage.mutateAsync({ circleId: circle.id, text: draft });
      setDraft("");
    } catch {
      // swallow; error shown by mutation state
    }
  }

  if (!isMember) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold">Circle Forum</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Only circle members can view and post messages in this forum.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Circle Forum</h3>
            <p className="text-sm text-muted-foreground">
              Coordinate contributions, share updates, and keep your circle in
              sync.
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {messageCountText}
          </span>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="space-y-4">
          <div className="max-h-[42rem] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading conversation…
              </p>
            ) : error ? (
              <p className="text-sm text-destructive">
                Unable to load messages. Try again later.
              </p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                There are no messages yet. Start the conversation.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((message) => {
                  const isOwn = message.userId === appUser?.id;
                  const createdAt = formatTime(message.createdAt);

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex max-w-[85%] flex-col gap-3 rounded-3xl border p-4",
                        isOwn
                          ? "self-end border-emerald-200 bg-emerald-50"
                          : "self-start border-slate-200 bg-white",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {message.senderAvatarUrl ? (
                            <AvatarImage
                              src={message.senderAvatarUrl}
                              alt={message.senderName}
                            />
                          ) : (
                            <AvatarFallback>
                              {getInitials(message.senderName)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">
                            {isOwn ? "You" : message.senderName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {createdAt}
                          </p>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900 dark:text-slate-100">
                        {message.text}
                      </p>
                    </div>
                  );
                })}
                <div ref={scrollAnchorRef} />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message to your circle..."
              rows={4}
              className="resize-none"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Keep messages respectful and related to circle contributions.
              </p>
              <Button
                onClick={handleSend}
                disabled={isSending || !draft.trim()}
              >
                {isSending ? "Sending…" : "Send message"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
