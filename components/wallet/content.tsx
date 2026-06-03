"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpFromLine,
  ArrowDownToLine,
  History,
  RefreshCwIcon,
  Copy,
  CheckIcon,
} from "lucide-react";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSettings } from "@/lib/providers/settings";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Wallet } from "@/lib/types/wallet";
import type { Transaction } from "@/lib/types/transaction";

// ─── Transaction row ──────────────────────────────────────────────────────────

const TX_ICONS: Record<string, string> = {
  deposit: "↓",
  withdrawal: "↑",
  contribution: "◎",
  payout: "✦",
  penalty: "⚠",
  referral_bonus: "✸",
  creation_fee: "◈",
};

const TX_COLORS: Record<string, string> = {
  deposit: "text-emerald-600 dark:text-emerald-400",
  withdrawal: "text-foreground",
  contribution: "text-blue-600 dark:text-blue-400",
  payout: "text-emerald-600 dark:text-emerald-400",
  penalty: "text-red-600 dark:text-red-400",
  referral_bonus: "text-purple-600 dark:text-purple-400",
  creation_fee: "text-muted-foreground",
};

function TxRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.direction === "credit";
  const dateStr = new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(tx.createdAt?.toDate?.() ?? new Date());

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 border-b border-border last:border-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-base">
        {TX_ICONS[tx.type] ?? "·"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {tx.description}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <p
          className={cn(
            "text-sm font-semibold font-mono",
            isCredit
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
          )}
        >
          {isCredit ? "+" : "-"}
          {formatNaira(tx.amount)}
        </p>
        {tx.status !== "success" && (
          <Badge
            variant={tx.status === "pending" ? "secondary" : "destructive"}
            className="text-[10px] h-4"
          >
            {tx.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold font-mono text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Main wallet content ──────────────────────────────────────────────────────

export function WalletContent() {
  const { firebaseUser } = useAuthStore();
  const settings = useSettings();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [txPage, setTxPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [referralCopied, setReferralCopied] = useState(false);
  const PAGE_SIZE = 10;

  // Real-time wallet listener
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(
      doc(db, "wallets", firebaseUser.uid),
      (snap) => {
        if (snap.exists()) setWallet(snap.data() as Wallet);
        setWalletLoading(false);
      },
      () => setWalletLoading(false),
    );
    return () => unsub();
  }, [firebaseUser]);

  // Transactions (paginated, one-time fetch on mount/page change)
  useEffect(() => {
    if (!firebaseUser) return;
    setTxLoading(true);

    getDocs(
      query(
        collection(db, "transactions"),
        where("userId", "==", firebaseUser.uid),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE + 1),
      ),
    )
      .then((snap) => {
        const docs = snap.docs.slice(0, PAGE_SIZE);
        setHasMore(snap.docs.length > PAGE_SIZE);
        setTransactions(
          docs.map((d) => ({ id: d.id, ...d.data() }) as Transaction),
        );
      })
      .catch(console.error)
      .finally(() => setTxLoading(false));
  }, [firebaseUser, txPage]);

  function copyReferralCode() {
    // appUser referral code stored in auth store
    navigator.clipboard
      .writeText(
        `${process.env.NEXT_PUBLIC_APP_URL}/register?ref=` +
          (firebaseUser?.uid?.slice(0, 8).toUpperCase() ?? ""),
      )
      .then(() => {
        setReferralCopied(true);
        setTimeout(() => setReferralCopied(false), 2000);
      });
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">My Wallet</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your balance, deposits and withdrawals.
            </p>
          </div>
        </div>

        {/* Balance card */}
        <BalanceCard wallet={wallet} isLoading={walletLoading} />

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button asChild size="lg" className="h-12 text-sm gap-2">
            <Link href="/wallet/deposit">
              <ArrowDownToLine className="size-4" />
              Fund Wallet
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 text-sm gap-2"
          >
            <Link href="/wallet/withdraw">
              <ArrowUpFromLine className="size-4" />
              Withdraw
            </Link>
          </Button>
        </div>

        {/* Stats */}
        {walletLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-4 space-y-1"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Total Saved"
              value={formatNaira(wallet?.totalSaved ?? 0)}
              sub="Lifetime contributions"
            />
            <StatTile
              label="Payouts Received"
              value={formatNaira(wallet?.totalReceived ?? 0)}
              sub="Lifetime payouts"
            />
            <StatTile
              label="Pending"
              value={formatNaira(wallet?.pending ?? 0)}
              sub="Awaiting settlement"
            />
            <StatTile
              label="Referral Earnings"
              value={formatNaira(wallet?.referralEarnings ?? 0)}
              sub="From invites"
            />
          </div>
        )}

        {/* Referral banner */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Earn ₦{settings.payouts.referralBonusKobo / 100} per referral
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share your invite link. You earn when they make their first
              deposit of ₦{settings.wallet.minDepositKobo / 100}+.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={copyReferralCode}
          >
            {referralCopied ? (
              <>
                <CheckIcon className="size-3.5 text-emerald-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy link
              </>
            )}
          </Button>
        </div>

        {/* Transactions */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <Skeleton className="size-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <History className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No transactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fund your wallet to get started.
                </p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/wallet/deposit">Fund Wallet</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
