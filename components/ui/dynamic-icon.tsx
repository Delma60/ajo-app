"use client";

import type { ReactNode } from "react";
import * as Icons from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name: string;
  fallback?: ReactNode;
}

export function DynamicIcon({
  name,
  fallback = null,
  ...props
}: DynamicIconProps) {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  if (!Icon) {
    return <>{fallback}</>;
  }
  return <Icon {...props} />;
}
