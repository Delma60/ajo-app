"use client";

import { EventClaim } from "@/lib/types/event";
import { formatNaira, parseTimestamp } from "@/lib/utils";
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
      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {claims.map((claim) => (
          <Card key={claim.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">
                    {claim.userId.substring(0, 8)}...
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {claim.rewardType.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    {claim.rewardAmountKobo
                      ? formatNaira(claim.rewardAmountKobo)
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(
                      parseTimestamp(claim.createdAt) ?? new Date(),
                      { addSuffix: true },
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Badge
                  variant={claim.status === "awarded" ? "default" : "secondary"}
                >
                  {claim.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
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
                  {formatDistanceToNow(
                    parseTimestamp(claim.createdAt) ?? new Date(),
                    {
                      addSuffix: true,
                    },
                  )}
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
