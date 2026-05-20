create table if not exists public.profiles (
  id uuid primary key,
  username text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Profiles viewable by owner" on public.profiles;
create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New chat',
  message_count int not null default 0,
  is_locked_pending_ad boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists threads_user_updated_idx on public.threads (user_id, updated_at desc);
alter table public.threads enable row level security;
drop policy if exists "Users select own threads" on public.threads;
create policy "Users select own threads" on public.threads for select using (auth.uid() = user_id);
drop policy if exists "Users insert own threads" on public.threads;
create policy "Users insert own threads" on public.threads for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own threads" on public.threads;
create policy "Users update own threads" on public.threads for update using (auth.uid() = user_id);
drop policy if exists "Users delete own threads" on public.threads;
create policy "Users delete own threads" on public.threads for delete using (auth.uid() = user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null,
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_created_idx on public.messages (thread_id, created_at);
alter table public.messages enable row level security;
drop policy if exists "Users select own messages" on public.messages;
create policy "Users select own messages" on public.messages for select using (auth.uid() = user_id);
drop policy if exists "Users insert own messages" on public.messages;
create policy "Users insert own messages" on public.messages for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own messages" on public.messages;
create policy "Users update own messages" on public.messages for update using (auth.uid() = user_id);
drop policy if exists "Users delete own messages" on public.messages;
create policy "Users delete own messages" on public.messages for delete using (auth.uid() = user_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  plan text not null default 'free' check (plan in ('free','pro_weekly','pro_monthly','pro_yearly')),
  status text not null default 'active' check (status in ('active','canceled','past_due','trialing','incomplete')),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "Users view own subscription" on public.subscriptions;
create policy "Users view own subscription" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "Users insert own subscription" on public.subscriptions;
create policy "Users insert own subscription" on public.subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own subscription" on public.subscriptions;
create policy "Users update own subscription" on public.subscriptions for update using (auth.uid() = user_id);

create table if not exists public.usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day date not null default current_date,
  image_uploads int not null default 0,
  bonus_uploads int not null default 0,
  ads_watched int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
alter table public.usage_daily enable row level security;
drop policy if exists "Users view own usage_daily" on public.usage_daily;
create policy "Users view own usage_daily" on public.usage_daily for select using (auth.uid() = user_id);
drop policy if exists "Users insert own usage_daily" on public.usage_daily;
create policy "Users insert own usage_daily" on public.usage_daily for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own usage_daily" on public.usage_daily;
create policy "Users update own usage_daily" on public.usage_daily for update using (auth.uid() = user_id);

create table if not exists public.usage_stats (
  user_id uuid primary key,
  questions_solved int not null default 0,
  total_ads_watched int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.usage_stats enable row level security;
drop policy if exists "Users view own usage_stats" on public.usage_stats;
create policy "Users view own usage_stats" on public.usage_stats for select using (auth.uid() = user_id);
drop policy if exists "Users insert own usage_stats" on public.usage_stats;
create policy "Users insert own usage_stats" on public.usage_stats for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own usage_stats" on public.usage_stats;
create policy "Users update own usage_stats" on public.usage_stats for update using (auth.uid() = user_id);

create or replace function public.bump_thread_message_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'user' then
    update public.threads set message_count = coalesce(message_count, 0) + 1, updated_at = now()
      where id = new.thread_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bump_thread_message_count on public.messages;
create trigger trg_bump_thread_message_count after insert on public.messages
  for each row execute function public.bump_thread_message_count();

create or replace function public.has_pro(_uid uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select case when auth.uid() is distinct from _uid then false else exists (
    select 1 from public.subscriptions where user_id = _uid
      and plan in ('pro_weekly','pro_monthly','pro_yearly')
      and status in ('active','trialing')
      and (current_period_end is null or current_period_end > now())
  ) end;
$$;

create or replace function public.get_or_create_usage_today(_uid uuid, _day date default current_date)
returns public.usage_daily language plpgsql security invoker set search_path = public as $$
declare row public.usage_daily;
begin
  if auth.uid() is distinct from _uid then raise exception 'not allowed'; end if;
  insert into public.usage_daily (user_id, day) values (_uid, _day) on conflict (user_id, day) do nothing;
  select * into row from public.usage_daily where user_id = _uid and day = _day;
  return row;
end;
$$;

create or replace function public.increment_image_upload(_uid uuid, _day date default current_date)
returns public.usage_daily language plpgsql security invoker set search_path = public as $$
declare row public.usage_daily;
begin
  if auth.uid() is distinct from _uid then raise exception 'not allowed'; end if;
  perform public.get_or_create_usage_today(_uid, _day);
  update public.usage_daily set image_uploads = image_uploads + 1 where user_id = _uid and day = _day returning * into row;
  return row;
end;
$$;

create or replace function public.add_bonus_upload(_uid uuid, _day date default current_date)
returns public.usage_daily language plpgsql security invoker set search_path = public as $$
declare row public.usage_daily;
begin
  if auth.uid() is distinct from _uid then raise exception 'not allowed'; end if;
  perform public.get_or_create_usage_today(_uid, _day);
  update public.usage_daily set bonus_uploads = bonus_uploads + 1 where user_id = _uid and day = _day returning * into row;
  return row;
end;
$$;

create or replace function public.increment_ads_watched(_uid uuid, _day date default current_date)
returns public.usage_daily language plpgsql security invoker set search_path = public as $$
declare row public.usage_daily;
begin
  if auth.uid() is distinct from _uid then raise exception 'not allowed'; end if;
  perform public.get_or_create_usage_today(_uid, _day);
  update public.usage_daily set ads_watched = ads_watched + 1 where user_id = _uid and day = _day returning * into row;
  insert into public.usage_stats (user_id, total_ads_watched) values (_uid, 1)
    on conflict (user_id) do update set total_ads_watched = public.usage_stats.total_ads_watched + 1, updated_at = now();
  return row;
end;
$$;

create or replace function public.bump_questions_solved(_uid uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is distinct from _uid then raise exception 'not allowed'; end if;
  insert into public.usage_stats (user_id, questions_solved) values (_uid, 1)
    on conflict (user_id) do update set questions_solved = public.usage_stats.questions_solved + 1, updated_at = now();
end;
$$;

insert into storage.buckets (id, name, public) values ('chat-uploads', 'chat-uploads', false) on conflict (id) do nothing;
drop policy if exists "Users read own chat uploads" on storage.objects;
create policy "Users read own chat uploads" on storage.objects for select
  using (bucket_id = 'chat-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users upload own chat uploads" on storage.objects;
create policy "Users upload own chat uploads" on storage.objects for insert
  with check (bucket_id = 'chat-uploads' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users delete own chat uploads" on storage.objects;
create policy "Users delete own chat uploads" on storage.objects for delete
  using (bucket_id = 'chat-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reference text not null unique,
  plan text not null,
  method text not null,
  amount integer not null,
  currency text not null default 'IDR',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_tx_user_idx on public.payment_transactions(user_id, created_at desc);
alter table public.payment_transactions enable row level security;
drop policy if exists "Users view own transactions" on public.payment_transactions;
create policy "Users view own transactions" on public.payment_transactions for select using (auth.uid() = user_id);
drop policy if exists "Users insert own transactions" on public.payment_transactions;
create policy "Users insert own transactions" on public.payment_transactions for insert with check (auth.uid() = user_id);
drop policy if exists "Users update own transactions" on public.payment_transactions;
create policy "Users update own transactions" on public.payment_transactions for update using (auth.uid() = user_id);

revoke execute on function public.bump_thread_message_count() from public, anon, authenticated;
revoke execute on function public.has_pro(uuid) from public, anon;
revoke execute on function public.get_or_create_usage_today(uuid, date) from public, anon;
revoke execute on function public.increment_image_upload(uuid, date) from public, anon;
revoke execute on function public.add_bonus_upload(uuid, date) from public, anon;
revoke execute on function public.increment_ads_watched(uuid, date) from public, anon;
revoke execute on function public.bump_questions_solved(uuid) from public, anon;
grant execute on function public.has_pro(uuid) to authenticated;
grant execute on function public.get_or_create_usage_today(uuid, date) to authenticated;
grant execute on function public.increment_image_upload(uuid, date) to authenticated;
grant execute on function public.add_bonus_upload(uuid, date) to authenticated;
grant execute on function public.increment_ads_watched(uuid, date) to authenticated;
grant execute on function public.bump_questions_solved(uuid) to authenticated;