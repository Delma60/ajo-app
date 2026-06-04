"use client";

import { TriggerType } from "@/lib/types/event";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Control,
  Controller,
  FieldPathValue,
  FieldValues,
  Path,
} from "react-hook-form";

interface ConditionInputsProps<T extends FieldValues> {
  triggerType: string;
  control: Control<T>;
  getFieldName: (field: Path<T>) => Path<T>;
  errors?: Record<string, any>;
}

/**
 * Dynamic condition input fields based on selected trigger type
 * Each trigger type has specific conditions that need to be configured
 */
export function ConditionInputs<T extends FieldValues>({
  triggerType,
  control,
  getFieldName,
  errors = {},
}: ConditionInputsProps<T>) {
  const renderConditionField = () => {
    switch (triggerType) {
      case "contribution_streak":
        return (
          <Controller
            name={getFieldName("minConsecutivePayments" as Path<T>)}
            control={control}
            defaultValue={"3" as FieldPathValue<T, Path<T>>}
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="minConsecutivePayments">
                  Min Consecutive On-Time Payments
                </Label>
                <Input
                  id="minConsecutivePayments"
                  type="number"
                  min="1"
                  placeholder="e.g. 3"
                  {...field}
                  onChange={(e) =>
                    field.onChange(e.target.value as FieldPathValue<T, Path<T>>)
                  }
                />
                {errors.minConsecutivePayments && (
                  <p className="text-xs text-destructive">
                    {errors.minConsecutivePayments.message}
                  </p>
                )}
              </div>
            )}
          />
        );

      case "circle_filled":
        return (
          <Controller
            name={getFieldName("minMemberCount" as Path<T>)}
            control={control}
            defaultValue={"3" as FieldPathValue<T, Path<T>>}
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="minMemberCount">
                  Min Members to Qualify (prevents 2-person abuse)
                </Label>
                <Input
                  id="minMemberCount"
                  type="number"
                  min="2"
                  placeholder="e.g. 3"
                  {...field}
                  onChange={(e) =>
                    field.onChange(e.target.value as FieldPathValue<T, Path<T>>)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Only circles with this many members or more will trigger the
                  reward
                </p>
                {errors.minMemberCount && (
                  <p className="text-xs text-destructive">
                    {errors.minMemberCount.message}
                  </p>
                )}
              </div>
            )}
          />
        );

      case "wallet_funded_threshold":
        return (
          <Controller
            name={getFieldName("minAmountNaira" as Path<T>)}
            control={control}
            defaultValue={"5000" as FieldPathValue<T, Path<T>>}
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="minAmountNaira">
                  Minimum Deposit Amount (₦)
                </Label>
                <Input
                  id="minAmountNaira"
                  type="number"
                  min="100"
                  step="100"
                  placeholder="e.g. 5000"
                  {...field}
                  onChange={(e) =>
                    field.onChange(e.target.value as FieldPathValue<T, Path<T>>)
                  }
                />
                {errors.minAmountNaira && (
                  <p className="text-xs text-destructive">
                    {errors.minAmountNaira.message}
                  </p>
                )}
              </div>
            )}
          />
        );

      case "wallet_total_saved_threshold":
        return (
          <Controller
            name={getFieldName("minAmountNaira" as Path<T>)}
            control={control}
            defaultValue={"50000" as FieldPathValue<T, Path<T>>}
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="minAmountNaira">Minimum Total Saved (₦)</Label>
                <Input
                  id="minAmountNaira"
                  type="number"
                  min="100"
                  step="100"
                  placeholder="e.g. 50000"
                  {...field}
                  onChange={(e) =>
                    field.onChange(e.target.value as FieldPathValue<T, Path<T>>)
                  }
                />
                {errors.minAmountNaira && (
                  <p className="text-xs text-destructive">
                    {errors.minAmountNaira.message}
                  </p>
                )}
              </div>
            )}
          />
        );

      case "investment_made":
        return (
          <Controller
            name={getFieldName("minAmountNaira" as Path<T>)}
            control={control}
            defaultValue={"5000" as FieldPathValue<T, Path<T>>}
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="minAmountNaira">
                  Minimum Investment Amount (₦)
                </Label>
                <Input
                  id="minAmountNaira"
                  type="number"
                  min="100"
                  step="100"
                  placeholder="e.g. 5000"
                  {...field}
                  onChange={(e) =>
                    field.onChange(e.target.value as FieldPathValue<T, Path<T>>)
                  }
                />
                {errors.minAmountNaira && (
                  <p className="text-xs text-destructive">
                    {errors.minAmountNaira.message}
                  </p>
                )}
              </div>
            )}
          />
        );

      case "referral_milestone":
        return (
          <Controller
            name={getFieldName("minReferralCount" as Path<T>)}
            control={control}
            defaultValue={"5" as FieldPathValue<T, Path<T>>}
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="minReferralCount">
                  Min Successful Referrals
                </Label>
                <Input
                  id="minReferralCount"
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  {...field}
                  onChange={(e) =>
                    field.onChange(e.target.value as FieldPathValue<T, Path<T>>)
                  }
                />
                {errors.minReferralCount && (
                  <p className="text-xs text-destructive">
                    {errors.minReferralCount.message}
                  </p>
                )}
              </div>
            )}
          />
        );

      case "circle_completed":
      case "circle_moderated":
      case "first_contribution":
      case "first_circle_joined":
      case "onboarding_complete":
        return (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground">
              This trigger has no additional conditions — it triggers
              automatically.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return renderConditionField();
}
