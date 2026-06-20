"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { monadTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "AdFunded AI",
  projectId:
    process.env.NEXT_PUBLIC_WC_PROJECT_ID || "adfunded_ai_dev_placeholder",
  chains: [monadTestnet],
  ssr: true,
});
