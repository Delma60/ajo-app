"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, SearchIcon, FilterIcon, Users2Icon } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMyCircles } from "@/lib/hooks/use-circle";
import { CircleCard, CircleCardSkeleton } from "@/components/circles/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Circle } from "@/lib/types/circle";

export function MyCirclesContent() {
  const { appUser, firebaseUser } = useAuthStore();
  const [search, setSearch] = useState("");

  const circleIds = appUser?.circleIds ?? [];
  const { circles, isLoading } = useMyCircles(circleIds);

  const filtered = circles.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const activeCircles = filtered.filter((c) => c.status === "active");
  const otherCircles = filtered.filter((c) => c.status !== "active");

  function isAdmin(circle: Circle) {
    return circle.adminId === firebaseUser?.uid;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">My Circles</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {circleIds.length === 0
                ? "You're not in any circles yet"
                : `${circleIds.length} circle${circleIds.length !== 1 ? "s" : ""} — ${activeCircles.length} active`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/circles/discover">
                <SearchIcon className="size-3.5" />
                Discover
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/circles/create">
                <Plus className="size-3.5" />
                Create
              </Link>
            </Button>
          </div>
        </div>

        {/* Search */}
        {circles.length > 0 && (
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search your circles…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <CircleCardSkeleton key={i} />
            ))}
          </div>
        ) : circles.length === 0 ? (
          <EmptyState />
        ) : (
          <Tabs defaultValue="active">
            <TabsList className="mb-4">
              <TabsTrigger value="active">
                Active
                {activeCircles.length > 0 && (
                  <span className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {activeCircles.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">All circles</TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {activeCircles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No active circles match your search.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeCircles.map((c) => (
                    <CircleCard key={c.id} circle={c} isAdmin={isAdmin(c)} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="all">
              <div className="space-y-4">
                {activeCircles.length > 0 && (
                  <section>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      Active ({activeCircles.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeCircles.map((c) => (
                        <CircleCard key={c.id} circle={c} isAdmin={isAdmin(c)} />
                      ))}
                    </div>
                  </section>
                )}
                {otherCircles.length > 0 && (
                  <section>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      Other ({otherCircles.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {otherCircles.map((c) => (
                        <CircleCard key={c.id} circle={c} isAdmin={isAdmin(c)} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted mb-4">
        <Users2Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold">You're not in any circles yet</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
        Create your own circle or browse public ones to start saving with your
        community.
      </p>
      <div className="flex gap-2 mt-6">
        <Button asChild>
          <Link href="/circles/create">
            <Plus className="size-3.5" />
            Create a Circle
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/circles/discover">Discover Circles</Link>
        </Button>
      </div>
    </div>
  );
}