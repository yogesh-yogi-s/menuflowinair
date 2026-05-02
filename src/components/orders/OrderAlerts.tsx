import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";

const STORAGE_KEY = "menuflow.orderAlerts";

export interface AlertPrefs {
  sound: boolean;
  notifications: boolean;
}

export function loadAlertPrefs(): AlertPrefs {
  if (typeof window === "undefined") return { sound: true, notifications: true };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sound: true, notifications: true };
    const parsed = JSON.parse(raw);
    return { sound: parsed.sound !== false, notifications: parsed.notifications !== false };
  } catch {
    return { sound: true, notifications: true };
  }
}

export function saveAlertPrefs(p: AlertPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

/** Generates a short beep using the WebAudio API — no asset needed. */
function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.start(t);
    o.stop(t + 0.42);
    setTimeout(() => ctx.close(), 600);
  } catch {
    // ignore
  }
}

/**
 * Hook that announces a new order via toast + beep + browser notification.
 * Returns a function the parent should call when a new order arrives.
 */
export function useOrderAlerts() {
  const prefsRef = useRef<AlertPrefs>(loadAlertPrefs());
  const askedRef = useRef(false);

  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default" &&
      prefsRef.current.notifications
    ) {
      Notification.requestPermission().catch(() => {
        // ignore
      });
    }
  }, []);

  return (orderSummary: { customer: string; total: number; platform: string }) => {
    const prefs = loadAlertPrefs();
    prefsRef.current = prefs;
    toast.success(`New ${orderSummary.platform} order — ${orderSummary.customer}`, {
      description: `Total $${orderSummary.total.toFixed(2)}`,
      icon: <Bell className="h-4 w-4" />,
    });
    if (prefs.sound) playBeep();
    if (
      prefs.notifications &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(`New ${orderSummary.platform} order`, {
          body: `${orderSummary.customer} — $${orderSummary.total.toFixed(2)}`,
        });
      } catch {
        // ignore
      }
    }
  };
}