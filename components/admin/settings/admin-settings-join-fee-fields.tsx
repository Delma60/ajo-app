import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InfoIcon } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface JoinFeeProtectionFieldsProps {
  maxJoinFeePercent: number;
  maxJoinFeeKobo: number;
  onChange: (
    field: "maxJoinFeePercent" | "maxJoinFeeKobo",
    value: number,
  ) => void;
  disabled?: boolean;
}

export function JoinFeeProtectionFields({
  maxJoinFeePercent,
  maxJoinFeeKobo,
  onChange,
  disabled,
}: JoinFeeProtectionFieldsProps) {
  const exampleContribKobo = 100_000;
  const exampleCapKobo = Math.min(
    Math.floor((exampleContribKobo * maxJoinFeePercent) / 100),
    maxJoinFeeKobo,
  );

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 border border-border px-3.5 py-3 text-xs text-muted-foreground">
        <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
        <p>
          These limits protect members from excessive join fees. The effective
          cap a circle admin can charge is:{" "}
          <strong className="text-foreground">
            min(contribution × {maxJoinFeePercent}%,{" "}
            {formatNaira(maxJoinFeeKobo)})
          </strong>
          . Example: on a ₦1,000 circle the max join fee would be{" "}
          <strong className="text-foreground">
            {formatNaira(exampleCapKobo)}
          </strong>
          .
        </p>
      </div>

      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1 flex-1">
          <p className="text-sm font-medium">
            Max join fee (% of contribution)
          </p>
          <p className="text-xs text-muted-foreground">
            Join fee cannot exceed this percentage of the circle's per-cycle
            contribution. Protects against fees disproportionate to circle
            value.
          </p>
        </div>
        <div className="shrink-0 w-36 space-y-1">
          <Label htmlFor="maxJoinFeePercent" className="sr-only">
            Max join fee percent
          </Label>
          <div className="relative">
            <Input
              id="maxJoinFeePercent"
              type="number"
              min={1}
              max={200}
              step={5}
              disabled={disabled}
              value={maxJoinFeePercent}
              onChange={(e) =>
                onChange(
                  "maxJoinFeePercent",
                  Math.max(1, Number(e.target.value) || 1),
                )
              }
              className="pr-8"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              %
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">1–200%</p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1 flex-1">
          <p className="text-sm font-medium">Max join fee (absolute cap)</p>
          <p className="text-xs text-muted-foreground">
            Hard ceiling on join fee regardless of contribution size. Prevents
            high-contribution circles from charging outsized fees in absolute
            terms.
          </p>
        </div>
        <div className="shrink-0 w-36 space-y-1">
          <Label htmlFor="maxJoinFeeKobo" className="sr-only">
            Max join fee absolute cap
          </Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              ₦
            </span>
            <Input
              id="maxJoinFeeKobo"
              type="number"
              min={0}
              step={500}
              disabled={disabled}
              value={maxJoinFeeKobo / 100}
              onChange={(e) =>
                onChange(
                  "maxJoinFeeKobo",
                  Math.round(Math.max(0, Number(e.target.value) || 0) * 100),
                )
              }
              className="pl-7"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {formatNaira(maxJoinFeeKobo)} current
          </p>
        </div>
      </div>
    </div>
  );
}
