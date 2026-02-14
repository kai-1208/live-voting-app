export interface Poll {
    id: string; // UUID
    question: string;
    option_a: string;
    option_b: string;
    votes_a: number;
    votes_b: number;
    created_at: string;
    expires_at?: string;
}

/*
-- Supabase (PostgreSQL) Create Table SQL

create table polls (
    id uuid default gen_random_uuid() primary key,
    question text not null,
    option_a text not null,
    option_b text not null,
    votes_a integer default 0,
    votes_b integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
*/