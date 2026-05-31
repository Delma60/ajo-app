"use client";

import { TrendingUpIcon, InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InvestmentPageHeader() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Investments</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                <InfoIcon className="size-4" />
                <span className="sr-only">About investments</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Invest your idle wallet balance in fixed-income instruments and
              earn competitive returns. Funds are locked for the duration of
              each package.
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Grow your savings with fixed-income investments.
        </p>
      </div>
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
        <TrendingUpIcon className="size-5 text-primary" />
      </div>
    </div>
  );
}