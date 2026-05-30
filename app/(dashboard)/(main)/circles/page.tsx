import { MyCirclesContent } from "@/components/circles/content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Circles",
  description: "View and manage your savings circles.",
};

export default function CirclesPage() {
  return <MyCirclesContent />;
}