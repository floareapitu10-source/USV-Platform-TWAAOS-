-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Helper function to check admin role
-- =====================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check organizer role
CREATE OR REPLACE FUNCTION is_organizer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('organizer', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PROFILES Policies
-- =====================================================
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE USING (is_admin());

-- =====================================================
-- CATEGORIES Policies
-- =====================================================
DROP POLICY IF EXISTS "categories_select_all" ON categories;
CREATE POLICY "categories_select_all" ON categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON categories;
CREATE POLICY "categories_insert_admin" ON categories
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "categories_update_admin" ON categories;
CREATE POLICY "categories_update_admin" ON categories
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "categories_delete_admin" ON categories;
CREATE POLICY "categories_delete_admin" ON categories
  FOR DELETE USING (is_admin());

-- =====================================================
-- EVENTS Policies
-- =====================================================
DROP POLICY IF EXISTS "events_select_public" ON events;
CREATE POLICY "events_select_public" ON events
  FOR SELECT USING (
    is_public = true 
    OR organizer_id = auth.uid() 
    OR is_admin()
  );

DROP POLICY IF EXISTS "events_insert_organizer" ON events;
CREATE POLICY "events_insert_organizer" ON events
  FOR INSERT WITH CHECK (is_organizer() AND organizer_id = auth.uid());

DROP POLICY IF EXISTS "events_update_organizer" ON events;
CREATE POLICY "events_update_organizer" ON events
  FOR UPDATE USING (organizer_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "events_delete_organizer" ON events;
CREATE POLICY "events_delete_organizer" ON events
  FOR DELETE USING (organizer_id = auth.uid() OR is_admin());

-- =====================================================
-- EVENT_REGISTRATIONS Policies
-- =====================================================
DROP POLICY IF EXISTS "registrations_select_own" ON event_registrations;
CREATE POLICY "registrations_select_own" ON event_registrations
  FOR SELECT USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM events WHERE events.id = event_registrations.event_id AND events.organizer_id = auth.uid()
    )
    OR is_admin()
  );

DROP POLICY IF EXISTS "registrations_insert_own" ON event_registrations;
CREATE POLICY "registrations_insert_own" ON event_registrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "registrations_update_own" ON event_registrations;
CREATE POLICY "registrations_update_own" ON event_registrations
  FOR UPDATE USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM events WHERE events.id = event_registrations.event_id AND events.organizer_id = auth.uid()
    )
    OR is_admin()
  );

DROP POLICY IF EXISTS "registrations_delete_own" ON event_registrations;
CREATE POLICY "registrations_delete_own" ON event_registrations
  FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- =====================================================
-- SUBSCRIPTIONS Policies
-- =====================================================
DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
CREATE POLICY "subscriptions_insert_own" ON subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "subscriptions_delete_own" ON subscriptions;
CREATE POLICY "subscriptions_delete_own" ON subscriptions
  FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- =====================================================
-- NOTIFICATIONS Policies
-- =====================================================
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT WITH CHECK (is_organizer() OR is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- =====================================================
-- SCRAPED_SOURCES Policies (Admin only)
-- =====================================================
DROP POLICY IF EXISTS "scraped_sources_select_admin" ON scraped_sources;
CREATE POLICY "scraped_sources_select_admin" ON scraped_sources
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "scraped_sources_insert_admin" ON scraped_sources;
CREATE POLICY "scraped_sources_insert_admin" ON scraped_sources
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "scraped_sources_update_admin" ON scraped_sources;
CREATE POLICY "scraped_sources_update_admin" ON scraped_sources
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "scraped_sources_delete_admin" ON scraped_sources;
CREATE POLICY "scraped_sources_delete_admin" ON scraped_sources
  FOR DELETE USING (is_admin());

-- =====================================================
-- SCRAPE_LOGS Policies (Admin only)
-- =====================================================
DROP POLICY IF EXISTS "scrape_logs_select_admin" ON scrape_logs;
CREATE POLICY "scrape_logs_select_admin" ON scrape_logs
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "scrape_logs_insert_admin" ON scrape_logs;
CREATE POLICY "scrape_logs_insert_admin" ON scrape_logs
  FOR INSERT WITH CHECK (is_admin());
