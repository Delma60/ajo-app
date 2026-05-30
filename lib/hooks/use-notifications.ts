"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  startAfter,
  getDocs,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Notification } from "@/lib/types/notification";

const PAGE_SIZE = 20;

// ─── Unread count hook (used by sidebar / bottom nav) ────────────────────────

export function useUnreadNotificationCount() {
  const { firebaseUser } = useAuthStore();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!firebaseUser) {
      setCount(0);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", firebaseUser.uid),
      where("read", "==", false)
    );

    const unsub = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(0)
    );

    return () => unsub();
  }, [firebaseUser]);

  return count;
}

// ─── Full notifications list hook (used by notification page) ────────────────

export function useNotifications() {
  const { firebaseUser } = useAuthStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Real-time listener for the first page
  useEffect(() => {
    if (!firebaseUser) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE + 1)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.slice(0, PAGE_SIZE);
        const data = docs.map(
          (d) => ({ id: d.id, ...d.data() } as Notification)
        );
        setNotifications(data);
        setHasMore(snap.docs.length > PAGE_SIZE);
        setLastDoc(docs[docs.length - 1] ?? null);
        setUnreadCount(data.filter((n) => !n.read).length);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!firebaseUser || !lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", firebaseUser.uid),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE + 1)
      );

      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, PAGE_SIZE);
      const data = docs.map((d) => ({ id: d.id, ...d.data() } as Notification));

      setNotifications((prev) => [...prev, ...data]);
      setHasMore(snap.docs.length > PAGE_SIZE);
      setLastDoc(docs[docs.length - 1] ?? null);
    } finally {
      setIsLoadingMore(false);
    }
  }, [firebaseUser, lastDoc, isLoadingMore]);

  // Mark single as read (client-side optimistic + Firestore write)
  const markAsRead = useCallback(
    async (notificationId: string) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await updateDoc(doc(db, "notifications", notificationId), {
          read: true,
        });
      } catch (err) {
        console.error("[use-notifications] markAsRead failed:", err);
      }
    },
    []
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!firebaseUser) return;

    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("[use-notifications] markAllAsRead failed:", err);
    }
  }, [firebaseUser, notifications]);

  return {
    notifications,
    isLoading,
    isLoadingMore,
    hasMore,
    unreadCount,
    loadMore,
    markAsRead,
    markAllAsRead,
  };
}