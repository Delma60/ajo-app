"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";

export default function SupportFab() {
  const [position, setPosition] = useState({ right: 32, bottom: 32 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, right: 32, bottom: 32 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("supportFabPosition");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setPosition({
        right: typeof parsed.right === "number" ? parsed.right : 32,
        bottom: typeof parsed.bottom === "number" ? parsed.bottom : 32,
      });
    } catch {
      // ignore malformed data
    }
  }, []);

  function clampPosition(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    draggingRef.current = true;
    movedRef.current = false;
    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      right: position.right,
      bottom: position.bottom,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;

    const nextRight = clampPosition(
      startRef.current.right - dx,
      12,
      window.innerWidth - 120,
    );
    const nextBottom = clampPosition(
      startRef.current.bottom - dy,
      12,
      window.innerHeight - 64,
    );

    setPosition({ right: nextRight, bottom: nextBottom });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (movedRef.current) {
      window.localStorage.setItem(
        "supportFabPosition",
        JSON.stringify(position),
      );
    }
  }

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (movedRef.current) {
      movedRef.current = false;
      event.preventDefault();
    }
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ right: position.right, bottom: position.bottom }}
      className="fixed z-50 cursor-grab transition-all md:cursor-grab"
    >
      <Link
        href="/support"
        aria-label="Contact support"
        onClick={handleClick}
        className="flex items-center rounded-full bg-primary px-4 py-3 text-white shadow-lg transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50"
      >
        <MessageCircle className="mr-2" />
        <span className="hidden sm:inline-block font-medium">Support</span>
      </Link>
    </div>
  );
}
