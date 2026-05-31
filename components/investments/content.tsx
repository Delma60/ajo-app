"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InvestmentPageHeader } from "@/components/investments/page-header";
import { InvestmentStatsCards } from "@/components/investments/stats-cards";
import { InvestmentWalletBanner } from "@/components/investments/wallet-banner";
import { InvestmentPositionsList } from "@/components/investments/positions-list";
import { InvestmentPackagesGrid } from "@/components/investments/packages-grid";
import { PurchaseModal } from "@/components/investments/purchase-modal";
import { useMyInvestments, usePortfolioSummary } from "@/lib/hooks/use-investments";
import { useWallet } from "@/lib/hooks/use-wallet";
import type { InvestmentPackage } from "@/lib/types/investment";

export function InvestmentsContent() {
  const { investments, isLoading: isLoadingInvestments } = useMyInvestments();
  const { data: summary, isLoading: isLoadingSummary } = usePortfolioSummary();
  const { wallet, isLoading: isLoadingWallet } = useWallet();

  const [selectedPackage, setSelectedPackage] = useState<InvestmentPackage | null>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  const walletBalance = wallet?.available ?? 0;

  function handleSelectPackage(pkg: InvestmentPackage) {
    setSelectedPackage(pkg);
    setPurchaseModalOpen(true);
  }

  const activeCount = investments.filter((i) => i.status === "active").length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Page header */}
        <InvestmentPageHeader />

        {/* Portfolio stats */}
        <InvestmentStatsCards
          summary={summary}
          isLoading={isLoadingSummary || isLoadingInvestments}
        />

        {/* Wallet balance banner */}
        <InvestmentWalletBanner
          walletBalance={walletBalance}
          isLoading={isLoadingWallet}
        />

        {/* Tabs: My Positions / Packages */}
        <Tabs defaultValue={activeCount > 0 ? "positions" : "packages"}>
          <TabsList>
            <TabsTrigger value="positions">
              My Positions
              {activeCount > 0 && (
                <span className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="packages">Browse Packages</TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="mt-5">
            <InvestmentPositionsList
              investments={investments}
              isLoading={isLoadingInvestments}
            />
          </TabsContent>

          <TabsContent value="packages" className="mt-5">
            <InvestmentPackagesGrid
              walletBalance={walletBalance}
              onSelectPackage={handleSelectPackage}
              isLoadingWallet={isLoadingWallet}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Purchase modal */}
      <PurchaseModal
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
        pkg={selectedPackage}
        walletBalance={walletBalance}
      />
    </div>
  );
}