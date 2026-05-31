import type { Metadata } from "next";
import { InvestmentsContent } from "@/components/investments/content";

export const metadata: Metadata = {
  title: "Investments",
  description:
    "Grow your savings with fixed-income investment packages. Earn up to 31% per annum.",
};

export default function InvestmentsPage() {
  return <InvestmentsContent />;
}