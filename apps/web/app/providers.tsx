"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useEffect, useState } from "react";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  type Theme,
} from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

const theme: Theme = darkTheme({
  accentColor: "#cc6b3d",
  accentColorForeground: "#0b0b0c",
  borderRadius: "medium",
  overlayBlur: "small",
});

/** Syncs the connected wallet address into an httpOnly-ish cookie session. */
function SessionSync() {
  const { address, isConnected } = useAccount();
  useEffect(() => {
    if (isConnected && address) {
      fetch("/api/auth/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      }).catch(() => {});
    } else {
      fetch("/api/auth/disconnect", { method: "POST" }).catch(() => {});
    }
  }, [address, isConnected]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact">
          <SessionSync />
          {mounted ? children : <div style={{ visibility: "hidden" }}>{children}</div>}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
