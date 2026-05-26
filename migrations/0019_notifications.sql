-- migrations/0019_notifications.sql
-- Notification system: persistent, user-scoped notifications

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type       text NOT NULL,
  title      text NOT NULL,
  message    text NOT NULL,
  read       boolean DEFAULT false NOT NULL,
  metadata   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());
