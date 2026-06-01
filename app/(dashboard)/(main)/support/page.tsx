"use client";

import { useState } from "react";
import type { Metadata } from "next";

import { SupportContentPage } from "@/components/support/content";

export const metadata: Metadata = {
  title: "Support — AjoSave",
};

export default function SupportPage() {
  

  return <SupportContentPage />
}
