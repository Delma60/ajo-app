"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type DocumentSnapshot,
} from "firebase/firestore";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Gift,
  AlertTriangle,
  Users,
  FilterIcon,
} from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNaira, cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types/transaction";

const PAGE_SIZE = 15;

const TYPE_META: Record<
  string,
  { icon: React.ElementType; iconBg: string; iconColor: string; label: string }
> = {
  deposit: {
    icon: ArrowDownLeft,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    label: "Deposit",
  },
  withdrawal: {
    icon: ArrowUpRight,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    label: "Withdrawal",
  },
  contribution: {
    icon: Users,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    label: "Contribution",
  },
  payout: {
    icon: CircleDollarSign,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    label: "Payout",
  },
  penalty: {
    icon: AlertTriangle,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
    label: "Penalty",
  },
  referral_bonus: {
    icon: Gift,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    label: "Referral Bonus",
  },
  creation_fee: {
    icon: CircleDollarSign,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    label: "Creation Fee",
  },
};

function TransactionRow({ tx }: { tx: Transaction }) {
  const meta = TYPE_META[tx.type] ?? TYPE_META.deposit;
  const Icon = meta.icon;
  const isCredit = tx.direction === "credit";

  const dateStr = new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format((tx.createdAt as any)?.toDate?.() ?? new Date());

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 border-b border-border last:border-0">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          meta.iconBg
        )}
      >
        <Icon className={cn("size-3.5", meta.iconColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {tx.description}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">{dateStr}</p>
          {tx.reference && (
            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
              {tx.reference}
            </p>
          )}
        </div>
      </div>

      <div className="text-right shrink-0 space-y-0.5">
        <p
          className={cn(
            "text-sm font-semibold font-mono",
            isCredit
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground"
          )}
        >
          {isCredit ? "+" : "-"}
          {formatNaira(tx.amount)}
        </p>
        <div className="flex items-center justify-end gap-1">
          <Badge
            variant={
              tx.status === "success"
                ? "secondary"
                : tx.status === "pending"
                ? "outline"
                : "destructive"
            }
            className="text-[10px] h-4"
          >
            {tx.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function TransactionsContent() {
  const { firebaseUser } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  async function fetchTransactions(
    cursor: DocumentSnapshot | null = null,
    reset = false
  ) {
    if (!firebaseUser) return;
    cursor ? setIsLoadingMore(true) : setIsLoading(true);

    try {
      let q = query(
        collection(db, "transactions"),
        where("userId", "==", firebaseUser.uid),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE + 1)
      );

      if (typeFilter !== "all") {
        q = query(
          collection(db, "transactions"),
          where("userId", "==", firebaseUser.uid),
          where("type", "==", typeFilter),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE + 1)
        );
      }

      if (cursor) {
        q = query(q, startAfter(cursor));
      }

      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, PAGE_SIZE);
      const newTxs = docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));

      setHasMore(snap.docs.length > PAGE_SIZE);
      setLastDoc(docs[docs.length - 1] ?? null);
      setTransactions((prev) => (reset ? newTxs : [...prev, ...newTxs]));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  // Refetch on filter change
  useEffect(() => {
    setLastDoc(null);
    setHasMore(true);
    fetchTransactions(null, true);
  }, [firebaseUser, typeFilter]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Transactions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your complete payment history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FilterIcon className="size-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdrawal">Withdrawals</SelectItem>
                <SelectItem value="contribution">Contributions</SelectItem>
                <SelectItem value="payout">Payouts</SelectItem>
                <SelectItem value="penalty">Penalties</SelectItem>
                <SelectItem value="referral_bonus">Referral Bonuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm text-muted-foreground font-normal">
              {typeFilter === "all" ? "All transactions" : TYPE_META[typeFilter]?.label ?? typeFilter}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <Skeleton className="size-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <div className="space-y-1 text-right">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <CircleDollarSign className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No transactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fund your wallet to get started.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
                {hasMore && (
                  <div className="pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={isLoadingMore}
                      onClick={() => fetchTransactions(lastDoc)}
                    >
                      {isLoadingMore ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}