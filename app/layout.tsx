import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/providers/auth";
import { QueryProvider } from "@/lib/providers/tanstack-query";
import { SettingsProvider } from "@/lib/providers/settings";
import {
  getSettings,
  serializeSettings,
} from "@/lib/services/settings-service";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteName = settings.general.siteName ?? "AjoSave";

  return {
    title: {
      template: `%s — ${siteName}`,
      default: `${siteName} — Community Savings`,
    },
    description:
      settings.general.siteDescription ??
      "Join circles, save together, and receive your payout. The modern way to do Ajo and Esusu.",
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),
    // Prevent user pinch-zoom / page scaling on mobile devices
    viewport:
      "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();
  const serializedSettings = serializeSettings(settings);

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfairDisplay.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <QueryProvider>
          <AuthProvider>
            <SettingsProvider settings={serializedSettings}>
              <TooltipProvider>{children}</TooltipProvider>
            </SettingsProvider>
          </AuthProvider>
        </QueryProvider>

        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "font-sans text-sm",
            },
          }}
        />
      </body>
    </html>
  );
}
