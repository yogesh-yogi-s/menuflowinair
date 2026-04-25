-- Run this in your Supabase SQL Editor to harden the admin-only introspection
-- RPCs with a server-side role check. Without this, any authenticated user
-- could call list_tables() / get_columns() directly and bypass the UI guard.

CREATE OR REPLACE FUNCTION public.list_tables()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT t.table_name::text
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_columns(_table text)
RETURNS TABLE(column_name text, data_type text, is_nullable text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT c.column_name::text, c.data_type::text, c.is_nullable::text
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = _table
    ORDER BY c.ordinal_position;
END;
$$;

-- Restrict EXECUTE: only authenticated users can call; the function itself
-- enforces the admin-only check and raises 42501 (Access denied) otherwise.
REVOKE ALL ON FUNCTION public.list_tables() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_columns(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_columns(text) TO authenticated;