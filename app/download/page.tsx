import type { Metadata } from "next";
import { HomeNavbar } from "@/components/home/home-navbar";
import { AppDownloadSection } from "@/components/home/app-download-section";
import { HomeFooter } from "@/components/home/home-footer";

export const metadata: Metadata = {
  title: "Download the AjoSave app",
  description:
    "Download the Android APK or iOS IPA directly from AjoSave. Install the app without using app stores.",
  openGraph: {
    title: "Download the AjoSave app",
    description:
      "Download the Android APK or iOS IPA directly from AjoSave. Install the app without using app stores.",
    type: "website",
  },
};

export default function DownloadPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      <HomeNavbar />
      <main className="flex-1 pt-16">
        <section className="bg-[#06110c] py-24">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <p className="text-sm uppercase tracking-[0.24em] text-emerald-400 opacity-90 mb-4">
              App download
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">
              Download the app directly from our website
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Install the latest AjoSave mobile package without the Play Store
              or App Store. Choose the correct package for your device and
              follow the installation instructions.
            </p>
          </div>
        </section>

        <AppDownloadSection />
      </main>
      <HomeFooter />
    </div>
  );
}
