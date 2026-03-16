import type { Metadata } from "next";
import WalletContextProvider from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "CVKT Agent",
  description: "Pay 0.10–0.50 SOL, get an AI-powered answer. Powered by pump.fun.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
