import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface Options<T> {
  /** Postgres table name in the public schema. */
  table: string;
  /** React Query key(s) to invalidate on every change. */
  invalidate?: unknown[][];
  /** Limit to specific events (default: all). */
  event?: RealtimeEvent;
  /** Optional filter, e.g. `owner_id=eq.${uid}`. */
  filter?: string;
  /** Called for INSERT events with the new row. */
  onInsert?: (row: T) => void;
  /** Called for UPDATE events with new/old rows. */
  onUpdate?: (newRow: T, oldRow: T) => void;
  /** Pause subscription when false. */
  enabled?: boolean;
}

/**
 * Subscribe to a Supabase Realtime channel and (optionally) invalidate
 * matching React Query caches. RLS still applies — the user only receives
 * events for rows they can read.
 */
export function useRealtimeTable<T = Record<string, unknown>>(opts: Options<T>) {
  const qc = useQueryClient();
  const {
    table,
    invalidate = [],
    event = "*",
    filter,
    onInsert,
    onUpdate,
    enabled = true,
  } = opts;

  useEffect(() => {
    if (!enabled) return;
    const channelName = `rt:${table}:${filter ?? "all"}`;
    const channel = supabase
      .channel(channelName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(
        "postgres_changes" as never,
        { event, schema: "public", table, filter },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          for (const key of invalidate) {
            qc.invalidateQueries({ queryKey: key });
          }
          if (payload.eventType === "INSERT" && onInsert) {
            onInsert(payload.new as T);
          } else if (payload.eventType === "UPDATE" && onUpdate) {
            onUpdate(payload.new as T, payload.old as T);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, event, enabled]);
}