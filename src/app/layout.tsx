import type { Metadata, Viewport } from "next";

import ShellClient from "@/components/shell/ShellClient";
import { getCommandPaletteOpportunities } from "@/lib/api/career-ops";
import { buildCommandItems } from "@/components/shell/shell-data";

import "@/styles/reset.css";
import "@/styles/tokens.css";
import "@/styles/globals.css";

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
      <body>
        <ShellClient commandItems={commandItems}>{children}</ShellClient>
      </body>
    </html>
  );
}
