import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const disputeSchema = z.object({
  transactionHash: z.string().min(1, "Transaction hash is required"),
  reason: z.string().min(5, "Please provide a reason for the dispute"),
});

type DisputeFormValues = z.infer<typeof disputeSchema>;

export function DisputeDialog({ open, onOpenChange, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DisputeFormValues) => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DisputeFormValues>({
    resolver: zodResolver(disputeSchema),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispute Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input {...register("transactionHash")}
              placeholder="Transaction Hash" />
            {errors.transactionHash && <p className="text-red-500 text-xs">{errors.transactionHash.message}</p>}
          </div>
          <div>
            <Input {...register("reason")}
              placeholder="Reason for dispute" />
            {errors.reason && <p className="text-red-500 text-xs">{errors.reason.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>Submit Dispute</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
