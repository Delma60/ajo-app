"use client";

import { useEffect, useState } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface AppPlatformInfo {
  enabled: boolean;
  version: string;
  downloadUrl: string;
  releaseNotes: string;
  lastUploadedAt: string | null;
}

interface DownloadInfo {
  android: AppPlatformInfo;
  ios: AppPlatformInfo;
  pageMessage: string;
}

export function AppDownloadSection() {
  const [downloadInfo, setDownloadInfo] = useState<DownloadInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/app/downloads")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDownloadInfo(json.data.appDistribution);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section className="bg-slate-950/95 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden bg-slate-900/90 border border-white/10 shadow-2xl shadow-slate-950/30">
          <CardHeader className="bg-slate-900/95 px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  <DownloadIcon className="size-4 text-emerald-400" />
                  Direct download
                </div>
                <CardTitle className="mt-4 text-3xl sm:text-4xl text-white">
                  Install the app from this website
                </CardTitle>
                <CardDescription className="mt-3 text-white/70 max-w-2xl">
                  {downloadInfo?.pageMessage ??
                    "Get the latest Android or iOS package directly from AjoSave. No app store required when the files are available."}
                </CardDescription>
              </div>
              <div className="grid gap-3 sm:grid-flow-col sm:auto-cols-max">
                {downloadInfo?.android.enabled ? (
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-white"
                  >
                    <a href={downloadInfo.android.downloadUrl} download>
                      Android APK
                    </a>
                  </Button>
                ) : null}
                {downloadInfo?.ios.enabled ? (
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="rounded-full text-white/90 border-white/10 bg-white/5 hover:bg-white/10"
                  >
                    <a href={downloadInfo.ios.downloadUrl} download>
                      iOS IPA
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
            {isLoading ? (
              <div className="rounded-2xl bg-slate-900/80 p-6 text-sm text-slate-300">
                Loading download details...
              </div>
            ) : !downloadInfo ||
              (!downloadInfo.android.enabled && !downloadInfo.ios.enabled) ? (
              <div className="rounded-2xl bg-slate-900/80 p-6 text-sm text-slate-300">
                Download links are not available yet. Check back soon or sign up
                for early access.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {downloadInfo.android.enabled && (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-semibold text-emerald-300">
                      Android APK
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Version {downloadInfo.android.version || "latest"}
                    </p>
                    <p className="mt-4 text-sm text-slate-400">
                      {downloadInfo.android.releaseNotes ||
                        "No release notes provided."}
                    </p>
                    {downloadInfo.android.lastUploadedAt && (
                      <p className="mt-4 text-xs text-slate-500">
                        Uploaded{" "}
                        {new Date(
                          downloadInfo.android.lastUploadedAt,
                        ).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                )}
                {downloadInfo.ios.enabled && (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-semibold text-emerald-300">
                      iOS IPA
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Version {downloadInfo.ios.version || "latest"}
                    </p>
                    <p className="mt-4 text-sm text-slate-400">
                      {downloadInfo.ios.releaseNotes ||
                        "No release notes provided."}
                    </p>
                    {downloadInfo.ios.lastUploadedAt && (
                      <p className="mt-4 text-xs text-slate-500">
                        Uploaded{" "}
                        {new Date(
                          downloadInfo.ios.lastUploadedAt,
                        ).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
