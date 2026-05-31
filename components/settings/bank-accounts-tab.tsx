"use client";

import { useState, useEffect, useCallback } from "react";
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
  AlertCircleIcon,
  RefreshCwIcon,
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BankAccount } from "@/lib/types/user";
import * as React from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlutterwaveBank {
  id: number;
  code: string;
  name: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const addBankSchema = z.object({
  bankCode: z.string().min(1, "Select a bank"),
  accountNumber: z
    .string()
    .length(10, "Account number must be exactly 10 digits")
    .regex(/^\d+$/, "Account number must contain only digits"),
});

type AddBankFormValues = z.infer<typeof addBankSchema>;

// ─── Hook: fetch banks from Flutterwave via our API ───────────────────────────

function useBanksList() {
  const [banks, setBanks] = useState<FlutterwaveBank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/banks");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load banks");
      setBanks(json.data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load banks";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  return { banks, isLoading, error, refetch: fetchBanks };
}

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
          : "border-border bg-card",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          account.isDefault ? "bg-primary/10" : "bg-muted",
        )}
      >
        <BuildingIcon
          className={cn(
            "size-5",
            account.isDefault ? "text-primary" : "text-muted-foreground",
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

// ─── Banks selector skeleton ──────────────────────────────────────────────────

function BankSelectorSkeleton() {
  return <Skeleton className="h-8 w-full rounded-lg" />;
}

// ─── Add bank form ────────────────────────────────────────────────────────────

function AddBankForm({
  onAdded,
  onCancel,
}: {
  onAdded: (account: BankAccount) => void;
  onCancel: () => void;
}) {
  const {
    banks,
    isLoading: banksLoading,
    error: banksError,
    refetch,
  } = useBanksList();

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [lastVerifiedInput, setLastVerifiedInput] = useState<{
    bankCode: string;
    accountNumber: string;
  } | null>(null);

  const [openBankPopover, setOpenBankPopover] = React.useState(false);
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useFormContext?.() ||
  useForm<AddBankFormValues>({
    resolver: zodResolver(addBankSchema),
  });

  const bankCode = watch("bankCode");
  const accountNumber = watch("accountNumber");

  // Reset verified name whenever the user changes either field
  useEffect(() => {
    if (
      lastVerifiedInput &&
      (bankCode !== lastVerifiedInput.bankCode ||
        accountNumber !== lastVerifiedInput.accountNumber)
    ) {
      setVerifiedName(null);
      setVerifyError(null);
    }
  }, [bankCode, accountNumber, lastVerifiedInput]);

  async function verifyAccount() {
    if (!bankCode || accountNumber?.length !== 10) return;

    setIsVerifying(true);
    setVerifyError(null);
    setVerifiedName(null);

    try {
      const res = await fetch("/api/payments/verify-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber, bankCode }),
      });

      const json = await res.json();

      if (!json.success || !json.data?.accountName) {
        setVerifyError(
          json.error ?? "Could not verify account. Please check the details.",
        );
        return;
      }

      setVerifiedName(json.data.accountName as string);
      setLastVerifiedInput({ bankCode, accountNumber });
    } catch {
      setVerifyError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setIsVerifying(false);
    }
  }

  function onSubmit(values: AddBankFormValues) {
    if (!verifiedName) {
      toast.error("Please verify the account number first.");
      return;
    }

    const bank = banks.find((b) => b.code === values.bankCode);
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

  const canVerify =
    bankCode && bankCode !== "" && accountNumber?.length === 10 && !isVerifying;

  const alreadyVerified =
    verifiedName !== null &&
    lastVerifiedInput?.bankCode === bankCode &&
    lastVerifiedInput?.accountNumber === accountNumber;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* Bank selector */}
      <div className="space-y-1.5">
        <Label htmlFor="bank-select">Bank</Label>
        {banksLoading ? (
          <BankSelectorSkeleton />
        ) : banksError ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{banksError}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refetch}
              className="gap-1.5"
            >
              <RefreshCwIcon className="size-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <Controller
            name="bankCode"
            control={control}
            render={({ field }) => {
              const selectedBank = banks.find((b) => b.code === field.value);
              return (
                <Popover
                  open={openBankPopover}
                  onOpenChange={setOpenBankPopover}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      role="combobox"
                      aria-expanded={openBankPopover}
                      className={cn(
                        "h-8 w-full justify-between",
                        errors.bankCode && "border-destructive",
                      )}
                    >
                      {selectedBank ? selectedBank.name : "Select a bank…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command shouldFilter={true}>
                      <CommandInput placeholder="Search banks…" />
                      <CommandList>
                        <CommandEmpty>No bank found.</CommandEmpty>
                        <CommandGroup>
                          {banks.map((bank) => (
                            <CommandItem
                              key={bank.code}
                              value={bank.code}
                              onSelect={() => {
                                field.onChange(bank.code);
                                setOpenBankPopover(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === bank.code
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {bank.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              );
            }}
          />
        )}
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
            variant={alreadyVerified ? "secondary" : "outline"}
            size="sm"
            disabled={!canVerify || alreadyVerified}
            onClick={verifyAccount}
            className="shrink-0"
          >
            {isVerifying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : alreadyVerified ? (
              <CheckCircle2Icon className="size-3.5 text-emerald-600" />
            ) : (
              "Verify"
            )}
          </Button>
        </div>
        {errors.accountNumber && (
          <p className="text-xs text-destructive">
            {errors.accountNumber.message}
          </p>
        )}
      </div>

      {/* Verification error */}
      {verifyError && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive">
          <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
          <p>{verifyError}</p>
        </div>
      )}

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
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!verifiedName || banksLoading}
        >
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
      toast.error("Failed to save bank account. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleSetDefault(id: string) {
    setIsUpdating(true);
    try {
      const updated = bankAccounts.map((b) => ({
        ...b,
        isDefault: b.id === id,
      }));
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
                Saved accounts for receiving withdrawals. You can add up to 5
                accounts.
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
              This bank account will be removed from your profile. You can add
              it again at any time.
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
