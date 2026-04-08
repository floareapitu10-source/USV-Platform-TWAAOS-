-- =====================================================
-- Event feedback (rating + review)
-- Rules:
-- - Only participants can leave feedback
-- - Only after event end (or start_date if end_date is null)
-- - One feedback per user per event
-- - Rating 1..5
-- - Comment required when rating < 3
-- =====================================================

CREATE TABLE IF NOT EXISTS event_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id),
  CONSTRAINT comment_required_low_rating CHECK (
    rating >= 3 OR (comment IS NOT NULL AND length(trim(comment)) > 0)
  )
);

ALTER TABLE event_feedback ENABLE ROW LEVEL SECURITY;

-- Helper: verify user participated
CREATE OR REPLACE FUNCTION is_participant(p_event_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM event_registrations r
    WHERE r.event_id = p_event_id
      AND r.user_id = auth.uid()
      AND r.status IN ('registered', 'attended')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: feedback allowed only after event end
CREATE OR REPLACE FUNCTION feedback_allowed_after_end(p_event_id uuid)
RETURNS boolean AS $$
DECLARE
  t_end timestamptz;
BEGIN
  SELECT COALESCE(e.end_date, e.start_date) INTO t_end
  FROM events e
  WHERE e.id = p_event_id;

  IF t_end IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOW() >= t_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies
DROP POLICY IF EXISTS "event_feedback_select_all" ON event_feedback;
CREATE POLICY "event_feedback_select_all" ON event_feedback
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_feedback_insert_own" ON event_feedback;
CREATE POLICY "event_feedback_insert_own" ON event_feedback
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND is_participant(event_id)
    AND feedback_allowed_after_end(event_id)
  );

DROP POLICY IF EXISTS "event_feedback_update_own" ON event_feedback;
CREATE POLICY "event_feedback_update_own" ON event_feedback
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND feedback_allowed_after_end(event_id)
  );

DROP POLICY IF EXISTS "event_feedback_delete_own" ON event_feedback;
CREATE POLICY "event_feedback_delete_own" ON event_feedback
  FOR DELETE USING (user_id = auth.uid());
