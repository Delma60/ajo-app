"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  BuildingIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  ShieldCheckIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth-store";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BankAccount } from "@/lib/types/user";

// ─── Nigerian banks list ──────────────────────────────────────────────────────

const NIGERIAN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "526", name: "Moniepoint MFB" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "ProvidusBank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "SunTrust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "627", name: "Kuda Bank" },
  { code: "565", name: "Carbon" },
  { code: "50515", name: "OPay" },
  { code: "50304", name: "Palmpay" },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const addBankSchema = z.object({
  bankCode: z.string().min(1, "Select a bank"),
  accountNumber: z
    .string()
    .length(10, "Account number must be exactly 10 digits")
    .regex(/^\d+$/, "Account number must contain only digits"),
});

type AddBankFormValues = z.infer<typeof addBankSchema>;

// ─── Bank account card ────────────────────────────────────────────────────────

function BankAccountCard({
  account,
  onSetDefault,
  onRemove,
  isUpdating,
}: {
  account: BankAccount;
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
  isUpdating: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 transition-colors",
        account.isDefault
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          account.isDefault ? "bg-primary/10" : "bg-muted"
        )}
      >
        <BuildingIcon
          className={cn(
            "size-5",
            account.isDefault ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{account.bankName}</p>
          {account.isDefault && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 border-primary/40 text-primary bg-primary/5 px-1.5"
            >
              Default
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          •••• {account.accountNumber.slice(-4)} · {account.accountName}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {!account.isDefault && (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isUpdating}
            onClick={() => onSetDefault(account.id)}
            title="Set as default"
          >
            <StarIcon className="size-4 text-muted-foreground" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isUpdating}
          onClick={() => onRemove(account.id)}
          title="Remove account"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Add bank form ────────────────────────────────────────────────────────────

function AddBankForm({
  onAdded,
  onCancel,
}: {
  onAdded: (account: BankAccount) => void;
  onCancel: () => void;
}) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AddBankFormValues>({
    resolver: zodResolver(addBankSchema),
  });

  const bankCode = watch("bankCode");
  const accountNumber = watch("accountNumber");

  // Simulate bank account verification (replace with real Flutterwave call)
  async function verifyAccount() {
    if (!bankCode || accountNumber?.length !== 10) return;
    setIsVerifying(true);
    setVerifiedName(null);
    try {
      // In production: call /api/payments/verify-account { bankCode, accountNumber }
      await new Promise((r) => setTimeout(r, 1200));
      setVerifiedName("ADAEZE CHINYERE OKONKWO"); // mock
    } catch {
      toast.error("Could not verify account. Check the details and try again.");
    } finally {
      setIsVerifying(false);
    }
  }

  function onSubmit(values: AddBankFormValues) {
    if (!verifiedName) {
      toast.error("Please verify the account number first.");
      return;
    }
    const bank = NIGERIAN_BANKS.find((b) => b.code === values.bankCode);
    if (!bank) return;

    const newAccount: BankAccount = {
      id: `bank-${Date.now()}`,
      bankCode: values.bankCode,
      bankName: bank.name,
      accountNumber: values.accountNumber,
      accountName: verifiedName,
      isDefault: false,
    };
    onAdded(newAccount);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* Bank selector */}
      <div className="space-y-1.5">
        <Label htmlFor="bank-select">Bank</Label>
        <select
          id="bank-select"
          className={cn(
            "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            errors.bankCode ? "border-destructive" : ""
          )}
          {...register("bankCode")}
        >
          <option value="">Select a bank…</option>
          {NIGERIAN_BANKS.sort((a, b) => a.name.localeCompare(b.name)).map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
        {errors.bankCode && (
          <p className="text-xs text-destructive">{errors.bankCode.message}</p>
        )}
      </div>

      {/* Account number + verify */}
      <div className="space-y-1.5">
        <Label htmlFor="account-number">Account number</Label>
        <div className="flex gap-2">
          <Input
            id="account-number"
            type="text"
            inputMode="numeric"
            maxLength={10}
            placeholder="0123456789"
            className="flex-1"
            aria-invalid={!!errors.accountNumber}
            {...register("accountNumber")}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!bankCode || accountNumber?.length !== 10 || isVerifying}
            onClick={verifyAccount}
            className="shrink-0"
          >
            {isVerifying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              "Verify"
            )}
          </Button>
        </div>
        {errors.accountNumber && (
          <p className="text-xs text-destructive">{errors.accountNumber.message}</p>
        )}
      </div>

      {/* Verified account name */}
      {verifiedName && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/30 p-3">
          <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
              Account verified
            </p>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
              {verifiedName}
            </p>
          </div>
        </div>
      )}

      {/* Security note */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheckIcon className="size-3.5 text-primary shrink-0" />
        Account details are verified securely via Flutterwave.
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={!verifiedName}>
          Add account
        </Button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BankAccountsTab() {
  const { appUser, firebaseUser, setAppUser } = useAuthStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const bankAccounts: BankAccount[] = appUser?.bankAccounts ?? [];

  async function persistAccounts(updated: BankAccount[]) {
    if (!firebaseUser) return;
    await updateDoc(doc(db, "users", firebaseUser.uid), {
      bankAccounts: updated,
      updatedAt: serverTimestamp(),
    });
    if (appUser) setAppUser({ ...appUser, bankAccounts: updated });
  }

  async function handleAdded(account: BankAccount) {
    setIsUpdating(true);
    try {
      const updated =
        bankAccounts.length === 0
          ? [{ ...account, isDefault: true }]
          : [...bankAccounts, account];
      await persistAccounts(updated);
      setShowAddForm(false);
      toast.success("Bank account added.");
    } catch {
      toast.error("Failed to save bank account.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleSetDefault(id: string) {
    setIsUpdating(true);
    try {
      const updated = bankAccounts.map((b) => ({ ...b, isDefault: b.id === id }));
      await persistAccounts(updated);
      toast.success("Default account updated.");
    } catch {
      toast.error("Failed to update default account.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRemove(id: string) {
    setIsUpdating(true);
    setRemovingId(null);
    try {
      const filtered = bankAccounts.filter((b) => b.id !== id);
      // If we removed the default, promote the first remaining account
      const updated =
        filtered.length > 0 && !filtered.some((b) => b.isDefault)
          ? [{ ...filtered[0], isDefault: true }, ...filtered.slice(1)]
          : filtered;
      await persistAccounts(updated);
      toast.success("Bank account removed.");
    } catch {
      toast.error("Failed to remove bank account.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription className="mt-1">
                Saved accounts for receiving withdrawals. You can add up to 5 accounts.
              </CardDescription>
            </div>
            {!showAddForm && bankAccounts.length < 5 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(true)}
                className="shrink-0"
              >
                <PlusIcon className="size-3.5" />
                Add account
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          {showAddForm && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
              <p className="text-sm font-semibold">New bank account</p>
              <AddBankForm
                onAdded={handleAdded}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {/* Empty state */}
          {bankAccounts.length === 0 && !showAddForm && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <BuildingIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No bank accounts saved</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Add a bank account to withdraw your wallet balance.
              </p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => setShowAddForm(true)}
              >
                <PlusIcon className="size-3.5" />
                Add bank account
              </Button>
            </div>
          )}

          {/* Account list */}
          {bankAccounts.length > 0 && (
            <div className="space-y-2">
              {bankAccounts.map((account) => (
                <BankAccountCard
                  key={account.id}
                  account={account}
                  onSetDefault={handleSetDefault}
                  onRemove={(id) => setRemovingId(id)}
                  isUpdating={isUpdating}
                />
              ))}
            </div>
          )}

          {/* Limit notice */}
          {bankAccounts.length >= 5 && (
            <p className="text-xs text-muted-foreground text-center">
              Maximum of 5 bank accounts reached. Remove one to add another.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Remove confirm dialog */}
      <AlertDialog
        open={!!removingId}
        onOpenChange={(open) => !open && setRemovingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove bank account?</AlertDialogTitle>
            <AlertDialogDescription>
              This bank account will be removed from your profile. You can add it again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => removingId && handleRemove(removingId)}
            >
              Remove account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}