import type { PlatformAdapter, PlatformId } from "./types";
import { createMockAdapter } from "./mock";
import { createUberEatsAdapter } from "./ubereats";

export const ALL_PLATFORMS: { id: PlatformId; description: string; isReal: boolean }[] = [
  { id: "Zomato", description: "Indian food delivery & discovery", isReal: false },
  { id: "Swiggy", description: "On-demand delivery in India", isReal: false },
  { id: "UberEats", description: "Global food delivery (real sandbox stub)", isReal: true },
  { id: "DoorDash", description: "US food delivery network", isReal: false },
  { id: "Grubhub", description: "US online ordering & delivery", isReal: false },
];

export function getAdapter(platform: PlatformId): PlatformAdapter {
  if (platform === "UberEats") return createUberEatsAdapter();
  return createMockAdapter(platform);
}

export type { PlatformAdapter, PlatformId } from "./types";
export { demoKeyFor } from "./mock";