-- push_subscriptions: stores browser Web Push subscriptions for nudge delivery
create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  subscription    jsonb not null,
  last_nudged_at  timestamptz,
  created_at      timestamptz default now(),
  constraint push_subscriptions_user_id_key unique (user_id)
);

alter table push_subscriptions enable row level security;

create policy "users manage own subscription"
  on push_subscriptions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
