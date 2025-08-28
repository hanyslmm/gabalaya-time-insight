-- Check for extensions in public schema and move them
DO $$
DECLARE
    ext_name text;
BEGIN
    -- Move any remaining extensions from public to extensions schema
    FOR ext_name IN 
        SELECT extname FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE n.nspname = 'public' AND extname IN ('pg_cron', 'pg_net')
    LOOP
        EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_name);
    END LOOP;
END
$$;