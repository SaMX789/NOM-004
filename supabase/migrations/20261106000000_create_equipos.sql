-- =====================================================================
-- ASCI NORMA 004 · Tabla de equipos y bucket 'equipos-fotos'
--   Fase 1 (pre-análisis por imágenes)  -> status = 'borrador'
--   Fase 2 (análisis profundo en texto) -> status = 'completado'
-- Ejecutar en Supabase: SQL Editor -> New query -> Run
-- =====================================================================

create table if not exists public.equipos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status             text not null default 'borrador'
                       check (status in ('borrador', 'completado')),

  -- Fase 1: datos generados por la IA (editables por el usuario)
  equipo             text not null default '',          -- Nombre del equipo (marca / modelo)
  descripcion_manual text not null default '',          -- Descripción técnica
  identificacion     text not null default '',          -- Tag / No. de inventario (opcional)
  departamento       text not null default '',          -- Área / ubicación (opcional)
  imagenes_urls      text[] not null
                       check (cardinality(imagenes_urls) between 1 and 2),

  -- Fase 2: condiciones de operación (captura humana)
  operadores         integer check (operadores is null or operadores >= 0),
  dias               text[] not null default '{}',     -- p. ej. {Lu,Ma,Mi,Ju,Vi,Sa}
  horas              numeric(4,1) check (horas is null or (horas >= 0 and horas <= 24)), -- Horas al día

  -- Fase 2: resultado del análisis profundo
  riesgos            jsonb,
  matriz             jsonb,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists equipos_user_status_idx
  on public.equipos (user_id, status, created_at desc);

-- Mantener updated_at al día
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists equipos_set_updated_at on public.equipos;
create trigger equipos_set_updated_at
  before update on public.equipos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y modifica sus propios equipos
-- ---------------------------------------------------------------------
alter table public.equipos enable row level security;

drop policy if exists "equipos_select_own" on public.equipos;
create policy "equipos_select_own" on public.equipos
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "equipos_insert_own" on public.equipos;
create policy "equipos_insert_own" on public.equipos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "equipos_update_own" on public.equipos;
create policy "equipos_update_own" on public.equipos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "equipos_delete_own" on public.equipos;
create policy "equipos_delete_own" on public.equipos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Supabase Storage: bucket público 'equipos-fotos'
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('equipos-fotos', 'equipos-fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "equipos_fotos_public_read" on storage.objects;
create policy "equipos_fotos_public_read" on storage.objects
  for select
  using (bucket_id = 'equipos-fotos');

drop policy if exists "equipos_fotos_auth_insert" on storage.objects;
create policy "equipos_fotos_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'equipos-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "equipos_fotos_auth_update" on storage.objects;
create policy "equipos_fotos_auth_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'equipos-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "equipos_fotos_auth_delete" on storage.objects;
create policy "equipos_fotos_auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'equipos-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
