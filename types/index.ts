export interface PollOption {
    label: string;
    votes: number;
    color: string;
}

export interface Poll {
    id: string; // UUID
    question: string;
    options: PollOption[];
    created_at: string;
    expires_at?: string;
}

/*
-- Supabase (PostgreSQL) Create Table SQL

-- 1. Create table with options column
create table polls (
    id uuid default gen_random_uuid() primary key,
    question text not null,
    options jsonb not null default '[]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    expires_at timestamp with time zone
);

-- 2. Create RPC function for voting
create or replace function vote_for_option(poll_id uuid, option_index int)
returns void as $$
begin
  update polls
  set options = jsonb_set(
    options,
    array[option_index::text, 'votes'],
    to_jsonb(coalesce((options->option_index->>'votes')::int, 0) + 1)
  )
  where id = poll_id;
end;
$$ language plpgsql;
*/