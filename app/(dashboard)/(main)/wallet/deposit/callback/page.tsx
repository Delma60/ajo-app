import type { Metadata } from "next";
import { DepositCallbackContent } from "@/components/wallet/deposit/callback-content";

export const metadata: Metadata = {
  title: "Payment Status",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    tx_ref?: string;
    transaction_id?: string;
  }>;
}

// Flutterwave redirects here with:
//   ?status=successful&tx_ref=DEP-xxxxx-xxxxxx&transaction_id=xxxxxxxx
// OR
//   ?status=cancelled&tx_ref=DEP-xxxxx-xxxxxx
export default async function DepositCallbackPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status ?? "unknown";
  const txRef = params.tx_ref ?? "";
  const transactionId = params.transaction_id ?? "";

  return (
    <DepositCallbackContent
      status={status}
      txRef={txRef}
      transactionId={transactionId}
    />
  );
}