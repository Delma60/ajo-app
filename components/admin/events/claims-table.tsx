"use client";

import { EventClaim } from "@/lib/types/event";
import { formatNaira } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ClaimsTableProps {
  claims: EventClaim[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ClaimsTable({
  claims,
  currentPage,
  totalPages,
  onPageChange,
}: ClaimsTableProps) {
  if (!claims || claims.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No claims yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Reward Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="text-sm font-medium">
                  {claim.userId.substring(0, 8)}...
                </TableCell>
                <TableCell className="text-sm capitalize">
                  {claim.rewardType.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="text-sm">
                  {claim.rewardAmountKobo
                    ? formatNaira(claim.rewardAmountKobo)
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      claim.status === "awarded" ? "default" : "secondary"
                    }
                  >
                    {claim.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(claim.createdAt.toDate(), {
                    addSuffix: true,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
