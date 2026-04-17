import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthInitializer } from "@/components/AuthInitializer";
import { GlobalAssemblyOverlay } from "@/components/GlobalAssemblyOverlay";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ofiere",
  description: "Agent Orchestration System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased text-foreground flex min-h-screen`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthInitializer>
            {children}
          </AuthInitializer>
          <GlobalAssemblyOverlay />
          <Toaster position="bottom-left" />
        </ThemeProvider>
      </body>
    </html>
  );
}
