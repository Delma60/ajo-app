"use client";

import { TriggerType } from "@/lib/types/event";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Users,
  Wallet,
  TrendingUp,
  Target,
  Gift,
  Award,
  CheckCircle2,
  BarChart3,
  Share2,
} from "lucide-react";

interface ConditionBadgeProps {
  triggerType: TriggerType;
  conditions: Record<string, any>;
  className?: string;
}

/**
 * Maps trigger types + conditions to human-readable condition badges
 * E.g., { triggerType: "contribution_streak", conditions: { minConsecutivePayments: 3 } }
 * renders as: "🎯 Pay 3 times on time"
 */
export function ConditionBadge({
  triggerType,
  conditions,
  className = "",
}: ConditionBadgeProps) {
  // Generate readable condition text based on trigger type
  const getConditionText = (): { text: string; icon: React.ReactNode } => {
    switch (triggerType) {
      case "contribution_streak":
        return {
          text: `Pay ${conditions.minConsecutivePayments || 3} times on time`,
          icon: <Target className="size-3.5" />,
        };

      case "circle_filled":
        return {
          text: `Fill ${conditions.minMemberCount || 3}+ member${
            (conditions.minMemberCount || 3) > 1 ? "s" : ""
          }`,
          icon: <Users className="size-3.5" />,
        };

      case "wallet_funded_threshold":
        return {
          text: `Deposit ₦${((conditions.minAmountKobo || 0) / 100).toLocaleString()}+`,
          icon: <Wallet className="size-3.5" />,
        };

      case "wallet_total_saved_threshold":
        return {
          text: `Save ₦${((conditions.minAmountKobo || 0) / 100).toLocaleString()}+`,
          icon: <BarChart3 className="size-3.5" />,
        };

      case "investment_made":
        return {
          text: `Invest ₦${((conditions.minAmountKobo || 5000) / 100).toLocaleString()}+`,
          icon: <TrendingUp className="size-3.5" />,
        };

      case "referral_milestone":
        return {
          text: `Refer ${conditions.minReferralCount || 1} person${
            (conditions.minReferralCount || 1) > 1 ? "s" : ""
          }`,
          icon: <Share2 className="size-3.5" />,
        };

      case "circle_completed":
        return {
          text: "Complete a full circle cycle",
          icon: <CheckCircle2 className="size-3.5" />,
        };

      case "circle_moderated":
        return {
          text: "Admin a circle to completion",
          icon: <Award className="size-3.5" />,
        };

      case "first_contribution":
        return {
          text: "Make your first contribution",
          icon: <Gift className="size-3.5" />,
        };

      case "first_circle_joined":
        return {
          text: "Join your first circle",
          icon: <Users className="size-3.5" />,
        };

      case "onboarding_complete":
        return {
          text: "No extra conditions required",
          icon: <CheckCircle2 className="size-3.5" />,
        };

      default:
        return {
          text: "Complete the trigger",
          icon: <Zap className="size-3.5" />,
        };
    }
  };

  const { text, icon } = getConditionText();

  return (
    <Badge variant="secondary" className={`gap-1.5 ${className}`}>
      <span className="flex items-center">{icon}</span>
      <span className="text-xs">{text}</span>
    </Badge>
  );
}
