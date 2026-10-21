-- StockLens — Row Level Security (PRD §6: pengguna hanya mengakses data miliknya).
-- Model akses:
--   authenticated → SELECT data bersama (companies/market_prices/financial_statements),
--                   CRUD penuh HANYA ATAS baris miliknya sendiri,
--                   DELETE harga pernyataan impor miliknya (via import_batches).
--   anon          → tidak ada akses apa pun (default deny RLS).
--   service_role  → bypass RLS, dipakai server-side untuk operasi admin/seed.

--> statement-breakpoint

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_notes ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint

-- profiles: milik sendiri, tanpa policy DELETE (ikut hilang bersama akun auth).
CREATE POLICY profiles_select_own ON profiles FOR SELECT
  USING (id = app.auth_uid());
CREATE POLICY profiles_insert_own ON profiles FOR INSERT
  WITH CHECK (id = app.auth_uid());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (id = app.auth_uid());

--> statement-breakpoint

-- Data bersama: semua user terautentikasi boleh membaca.
CREATE POLICY companies_select_all ON companies FOR SELECT
  USING (true);
CREATE POLICY market_prices_select_all ON market_prices FOR SELECT
  USING (true);
CREATE POLICY financial_statements_select_all ON financial_statements FOR SELECT
  USING (true);

-- Pengguna dapat menghapus baris hasil impor miliknya (melalui pemilik batch).
CREATE POLICY market_prices_delete_own_import ON market_prices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM import_batches ib
      WHERE ib.id = market_prices.import_batch_id
        AND ib.user_id = app.auth_uid()
    )
  );
CREATE POLICY financial_statements_delete_own_import ON financial_statements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM import_batches ib
      WHERE ib.id = financial_statements.import_batch_id
        AND ib.user_id = app.auth_uid()
    )
  );

--> statement-breakpoint

-- Tabel personal bertanda user_id: CRUD penuh atas baris milik sendiri.
CREATE POLICY import_batches_all_own ON import_batches FOR ALL
  USING (user_id = app.auth_uid())
  WITH CHECK (user_id = app.auth_uid());
CREATE POLICY watchlists_all_own ON watchlists FOR ALL
  USING (user_id = app.auth_uid())
  WITH CHECK (user_id = app.auth_uid());
CREATE POLICY portfolios_all_own ON portfolios FOR ALL
  USING (user_id = app.auth_uid())
  WITH CHECK (user_id = app.auth_uid());
CREATE POLICY valuation_scenarios_all_own ON valuation_scenarios FOR ALL
  USING (user_id = app.auth_uid())
  WITH CHECK (user_id = app.auth_uid());
CREATE POLICY saved_screens_all_own ON saved_screens FOR ALL
  USING (user_id = app.auth_uid())
  WITH CHECK (user_id = app.auth_uid());
CREATE POLICY research_notes_all_own ON research_notes FOR ALL
  USING (user_id = app.auth_uid())
  WITH CHECK (user_id = app.auth_uid());

--> statement-breakpoint

-- Child tabel milik melalui parent (watchlists/portfolios).
CREATE POLICY watchlist_items_select_own ON watchlist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_items.watchlist_id AND w.user_id = app.auth_uid()
    )
  );
CREATE POLICY watchlist_items_write_own ON watchlist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_items.watchlist_id AND w.user_id = app.auth_uid()
    )
  );
CREATE POLICY watchlist_items_update_own ON watchlist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_items.watchlist_id AND w.user_id = app.auth_uid()
    )
  );
CREATE POLICY watchlist_items_delete_own ON watchlist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM watchlists w
      WHERE w.id = watchlist_items.watchlist_id AND w.user_id = app.auth_uid()
    )
  );

--> statement-breakpoint

CREATE POLICY portfolio_transactions_select_own ON portfolio_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_transactions.portfolio_id AND p.user_id = app.auth_uid()
    )
  );
CREATE POLICY portfolio_transactions_insert_own ON portfolio_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_transactions.portfolio_id AND p.user_id = app.auth_uid()
    )
  );
CREATE POLICY portfolio_transactions_update_own ON portfolio_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_transactions.portfolio_id AND p.user_id = app.auth_uid()
    )
  );
CREATE POLICY portfolio_transactions_delete_own ON portfolio_transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_transactions.portfolio_id AND p.user_id = app.auth_uid()
    )
  );

--> statement-breakpoint

-- Grant hak akses — portabel: hanya diterapkan jika role tersedia (ada di Supabase).
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      CONTINUE;
    END IF;

    EXECUTE format('GRANT USAGE ON SCHEMA app TO %I', role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION app.auth_uid() TO %I', role_name);

    IF role_name = 'authenticated' THEN
      EXECUTE 'GRANT SELECT ON companies, market_prices, financial_statements TO authenticated';
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON
               profiles, import_batches, watchlists, watchlist_items,
               portfolios, portfolio_transactions, valuation_scenarios,
               saved_screens, research_notes
               TO authenticated';
    END IF;

    IF role_name = 'service_role' THEN
      EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role';
    END IF;
  END LOOP;
END;
$$;
