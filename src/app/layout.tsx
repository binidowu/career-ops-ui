import type { Metadata, Viewport } from "next";
import { Literata, Albert_Sans, JetBrains_Mono } from "next/font/google";

import ShellClient from "@/components/shell/ShellClient";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import { getCommandPaletteOpportunities } from "@/lib/api/career-ops";
import { buildCommandItems } from "@/components/shell/shell-data";

import "@/styles/reset.css";
import "@/styles/tokens.css";
import "@/styles/globals.css";

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
});

const albertSans = Albert_Sans({
  subsets: ["latin"],
  variable: "--font-albert-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Career-Ops",
    template: "%s · Career-Ops",
  },
  description:
    "A measured command center for evaluating roles, managing a deliberate pipeline, and tailoring the next move.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const commandItems = buildCommandItems(
    await getCommandPaletteOpportunities(),
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('career-ops-theme')||'light';if(t!=='system')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${literata.variable} ${albertSans.variable} ${jetbrainsMono.variable}`}>
        <ThemeProvider>
          <ShellClient commandItems={commandItems}>{children}</ShellClient>
        </ThemeProvider>
      </body>
    </html>
  );
}
