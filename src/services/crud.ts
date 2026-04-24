import { supabase } from "@/integrations/supabase/client";

export interface ListOptions {
  filters?: Record<string, string | number | boolean | null>;
  search?: { column: string; query: string };
  orderBy?: { column: string; ascending?: boolean };
  page?: number;
  pageSize?: number;
}

export interface ListResult<T> {
  data: T[];
  count: number;
}

/** Generic select with filters, search (ilike), order, pagination. */
export async function getAll<T = Record<string, unknown>>(
  table: string,
  opts: ListOptions = {},
): Promise<ListResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any).from(table).select("*", { count: "exact" });

  if (opts.filters) {
    for (const [k, v] of Object.entries(opts.filters)) {
      if (v === null) query = query.is(k, null);
      else query = query.eq(k, v);
    }
  }
  if (opts.search?.query) {
    query = query.ilike(opts.search.column, `%${opts.search.query}%`);
  }
  if (opts.orderBy) {
    query = query.order(opts.orderBy.column, { ascending: opts.orderBy.ascending ?? true });
  }
  if (opts.page !== undefined && opts.pageSize) {
    const from = opts.page * opts.pageSize;
    const to = from + opts.pageSize - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as T[], count: count ?? 0 };
}

export async function getById<T = Record<string, unknown>>(table: string, id: string): Promise<T | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as T | null;
}

export async function createRecord<T = Record<string, unknown>>(table: string, payload: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from(table).insert(payload).select().single();
  if (error) throw error;
  return data as T;
}

export async function updateRecord<T = Record<string, unknown>>(
  table: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as T;
}

export async function deleteRecord(table: string, id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table).delete().eq("id", id);
  if (error) throw error;
}

/** Admin-only RPC: list public tables. */
export async function listTables(): Promise<string[]> {
  const { data, error } = await supabase.rpc("list_tables");
  if (error) throw error;
  return (data ?? []).map((r: { table_name: string }) => r.table_name);
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

/** Admin-only RPC: get column metadata for a table. */
export async function getColumns(tableName: string): Promise<ColumnInfo[]> {
  const { data, error } = await supabase.rpc("get_columns", { _table: tableName });
  if (error) throw error;
  return data ?? [];
}