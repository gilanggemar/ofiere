import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthInitializer } from "@/components/AuthInitializer";
import { GlobalAssemblyOverlay } from "@/components/GlobalAssemblyOverlay";

const outfit = Outfit({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NERV.OS",
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
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased text-foreground flex min-h-screen`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthInitializer>
            {children}
          </AuthInitializer>
          <GlobalAssemblyOverlay />
        </ThemeProvider>
      </body>
    </html>
  );
}
