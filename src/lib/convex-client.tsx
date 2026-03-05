"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";

export function ConvexAppProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    if (!CONVEX_URL) {
      console.warn("NEXT_PUBLIC_CONVEX_URL is not set; Convex requests will fail until configured.");
    }
    const url = CONVEX_URL || "https://placeholder.convex.cloud";
    return new ConvexReactClient(url);
  }, []);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
