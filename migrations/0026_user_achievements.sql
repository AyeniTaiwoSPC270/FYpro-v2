-- migrations/0026_user_achievements.sql

CREATE TABLE IF NOT EXISTS user_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  earned_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can read their own achievements only
CREATE POLICY "user_achievements_select_own"
  ON user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

-- No client INSERT/UPDATE/DELETE — service role writes only
