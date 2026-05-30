import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Gift,
  AlertTriangle,
  Users,
  ExternalLink,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/utils";
import type { Transaction } from "@/lib/types/transaction";

// Typed transaction for display purposes
export interface DisplayTransaction {
  id: string;
  type: "deposit" | "withdrawal" | "contribution" | "payout" | "penalty" | "referral_bonus" | "creation_fee";
  direction: "credit" | "debit";
  amount: number;
  status: "pending" | "success" | "failed" | "cancelled";
  description: string;
  createdAt: Date;
}

const TYPE_META: Record<
  DisplayTransaction["type"],
  { icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  deposit: {
    icon: ArrowDownLeft,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  withdrawal: {
    icon: ArrowUpRight,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  contribution: {
    icon: Users,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  payout: {
    icon: CircleDollarSign,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  penalty: {
    icon: AlertTriangle,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  referral_bonus: {
    icon: Gift,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  creation_fee: {
    icon: CircleDollarSign,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  },
};

function TransactionRow({ tx }: { tx: DisplayTransaction }) {
  const meta = TYPE_META[tx.type];
  const Icon = meta.icon;
  const isCredit = tx.direction === "credit";

  const dateStr = new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(tx.createdAt);

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      {/* Icon */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl",
          meta.iconBg
        )}
      >
        <Icon className={cn("size-3.5", meta.iconColor)} />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {tx.description}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
      </div>

      {/* Amount + status */}
      <div className="text-right shrink-0">
        <p
          className={cn(
            "text-sm font-semibold font-mono",
            isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
          )}
        >
          {isCredit ? "+" : "-"}
          {formatNaira(tx.amount)}
        </p>
        {tx.status !== "success" && (
          <Badge
            variant={
              tx.status === "pending"
                ? "secondary"
                : tx.status === "failed"
                ? "destructive"
                : "outline"
            }
            className="text-[10px] h-4 mt-0.5"
          >
            {tx.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

interface RecentTransactionsProps {
  transactions: DisplayTransaction[];
  isLoading?: boolean;
}

export function RecentTransactions({
  transactions,
  isLoading,
}: RecentTransactionsProps) {
  if (isLoading) {
    return <RecentTransactionsSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Recent Transactions</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/transactions" className="gap-1 text-xs text-muted-foreground">
              View all
              <ExternalLink className="size-3" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
              <CircleDollarSign className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Fund your wallet to get started.
            </p>
            <Button size="sm" className="mt-4" asChild>
              <Link href="/wallet">Fund Wallet</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentTransactionsSkeleton() {
  return (
    <Card>
      <CardHeader className="border-b">
        <Skeleton className="h-4 w-36" />
        <CardAction>
          <Skeleton className="h-6 w-16" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <Skeleton className="size-8 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}