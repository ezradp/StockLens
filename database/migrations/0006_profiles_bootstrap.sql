-- StockLens — profiles bootstrap di Supabase (Phase 2 — Auth).
-- Setiap user baru di auth.users otomatis mendapat baris profiles 1:1.
-- Portabel: seluruh blok hanya aktif jika schema `auth` (Supabase) tersedia.
-- Tambahkan juga backfill untuk user yang dibuat sebelum trigger ini ada.

DO $bootstrap$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION app.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
    BEGIN
      INSERT INTO public.profiles (id)
      VALUES (NEW.id)
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();

    INSERT INTO public.profiles (id) SELECT u.id FROM auth.users u ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$bootstrap$;
