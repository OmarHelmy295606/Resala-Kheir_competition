-- Video submissions. Run this once in Supabase → SQL Editor.
-- Rows are written by the Google Apps Script (apps-script/Code.gs),
-- never by the website. Admins change points in the Google Sheet.

create table public.submissions (
  id uuid primary key,                    -- "Submission ID" column in the sheet
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_url text not null,                -- Google Drive link(s) from the form
  points integer not null default 1 check (points in (0, 1)),
  submitted_at timestamptz not null default now()
);

create index submissions_user_id_idx on public.submissions (user_id);

alter table public.submissions enable row level security;

-- Users can see their own submissions (for the "My submissions" list)
create policy "Users read own submissions"
  on public.submissions for select to authenticated
  using (auth.uid() = user_id);

-- Keep profiles.score equal to the sum of a user's points,
-- so get_leaderboard() stays correct without any changes.
create or replace function public.refresh_score()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update profiles
    set score = (select coalesce(sum(points), 0) from submissions where user_id = old.user_id)
    where id = old.user_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update profiles
    set score = (select coalesce(sum(points), 0) from submissions where user_id = new.user_id)
    where id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger on_submission_changed
  after insert or update or delete on public.submissions
  for each row execute function public.refresh_score();
