/*
Projekt je pryč: vytvoř nový, v SQL editoru spusť schema.sql, v .env.local změň URL a klíč a spusť npm run restore -- backups/nejnovější.json.
*/

create extension if not exists unaccent with schema extensions;

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text,
  platform text,
  thumbnail_url text,
  servings int,
  time_minutes int,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  tags text[] not null default '{}',
  rating smallint check (rating between 1 and 5),
  status text not null default 'to_try' check (status in ('to_try', 'tried')),
  notes text,
  last_cooked_at date,
  is_complete boolean not null default true,
  created_at timestamptz not null default now(),
  search_text text not null default ''
);

create or replace function recipes_update_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := lower(extensions.unaccent(
    coalesce(new.title, '') || ' ' ||
    coalesce(new.notes, '') || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '') || ' ' ||
    coalesce(
      (select string_agg(i->>'name', ' ')
       from jsonb_array_elements(new.ingredients) i),
      ''
    )
  ));
  return new;
end;
$$;

drop trigger if exists recipes_search_text_trg on recipes;
create trigger recipes_search_text_trg
before insert or update on recipes
for each row execute function recipes_update_search_text();

alter table recipes disable row level security;