-- =====================================================================
-- El límite de intentos de la contraseña del Panel Admin estaba atado
-- solo a auth.uid(): como cualquiera puede abrir una sesión anónima
-- nueva sin más que borrar cookies o abrir una ventana de incógnito, ese
-- límite se podía saltar sin esfuerzo (sesión nueva = contador a cero).
-- Ahora también se puede pasar una clave de cliente (la IP, que
-- construye la ruta de Next.js) y el límite se aplica sobre esa clave
-- cuando está disponible, mucho más cara de cambiar que una sesión.
-- =====================================================================

drop function if exists public.verify_panel_admin_password(text);
create or replace function public.verify_panel_admin_password(p_password text, p_client_key text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_correct boolean;
  v_allowed boolean;
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select password_hash into v_hash from public.panel_admin_config where id = 'main';
  v_correct := v_hash is not null and crypt(p_password, v_hash) = v_hash;

  if not v_correct then
    v_key := 'panel_admin_verify_fail:' || coalesce(nullif(trim(p_client_key), ''), auth.uid()::text);
    select public.check_rate_limit(v_key, 15, 300) into v_allowed;
    if not v_allowed then
      return false;
    end if;
  end if;

  return v_correct;
end;
$$;

drop function if exists public.panel_admin_set_theme(text, text);
create or replace function public.panel_admin_set_theme(p_password text, p_theme text, p_client_key text default null)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.verify_panel_admin_password(p_password, p_client_key) then
    return query select false, 'Contraseña incorrecta.';
    return;
  end if;
  if p_theme not in ('dark', 'light') then
    return query select false, 'Tema no válido.';
    return;
  end if;
  update public.panel_admin_config set theme = p_theme, updated_at = now() where id = 'main';
  perform public.write_audit_log(auth.uid(), 'panel_admin_cambio_tema', null, jsonb_build_object('theme', p_theme));
  return query select true, 'Tema actualizado.';
end;
$$;

drop function if exists public.panel_admin_set_password(text, text);
create or replace function public.panel_admin_set_password(p_current_password text, p_new_password text, p_client_key text default null)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.verify_panel_admin_password(p_current_password, p_client_key) then
    return query select false, 'La contraseña actual no es correcta.';
    return;
  end if;
  if p_new_password !~ '^[0-9]{4,12}$' then
    return query select false, 'La nueva contraseña debe tener solo números (entre 4 y 12 dígitos).';
    return;
  end if;
  update public.panel_admin_config set password_hash = crypt(p_new_password, gen_salt('bf')), updated_at = now() where id = 'main';
  perform public.write_audit_log(auth.uid(), 'panel_admin_password_cambiada', null, '{}'::jsonb);
  return query select true, 'Contraseña actualizada.';
end;
$$;

drop function if exists public.panel_admin_search_citizens(text, text);
create or replace function public.panel_admin_search_citizens(p_password text, p_query text, p_client_key text default null)
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  dni_number text,
  roblox_username text,
  role public.app_role,
  job_id uuid,
  job_code text,
  job_name text
)
language plpgsql security definer set search_path = public as $$
declare
  v_query text := trim(regexp_replace(p_query, '\s+', ' ', 'g'));
  v_tokens text[];
begin
  if not public.verify_panel_admin_password(p_password, p_client_key) then
    raise exception 'Contraseña incorrecta';
  end if;

  v_tokens := string_to_array(v_query, ' ');
  return query
    select d.profile_id, d.first_name, d.last_name, d.dni_number, d.roblox_username, p.role, j.id, j.code, j.name
    from public.dnis d
    join public.profiles p on p.id = d.profile_id
    left join public.bank_accounts b on b.profile_id = d.profile_id
    left join public.jobs j on j.id = b.job_id
    where d.dni_number ilike '%' || v_query || '%'
       or unaccent(lower(d.roblox_username)) ilike unaccent(lower('%' || v_query || '%'))
       or not exists (
            select 1 from unnest(v_tokens) as tok
            where tok <> ''
              and unaccent(lower(d.first_name || ' ' || d.last_name)) not ilike '%' || unaccent(lower(tok)) || '%'
          )
    order by d.first_name
    limit 20;
end;
$$;

drop function if exists public.panel_admin_set_job(text, uuid, uuid);
create or replace function public.panel_admin_set_job(p_password text, p_profile_id uuid, p_job_id uuid, p_client_key text default null)
returns table (success boolean, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_job_code text;
begin
  if not public.verify_panel_admin_password(p_password, p_client_key) then
    return query select false, 'Contraseña incorrecta.';
    return;
  end if;

  update public.bank_accounts set job_id = p_job_id where profile_id = p_profile_id;
  if not found then
    return query select false, 'Este ciudadano no tiene cuenta bancaria (no tiene DNI).';
    return;
  end if;

  select code into v_job_code from public.jobs where id = p_job_id;
  perform public.sync_police_access_for_job(p_profile_id, v_job_code);

  perform public.write_audit_log(auth.uid(), 'panel_admin_cambio_empleo', p_profile_id::text, jsonb_build_object('job_id', p_job_id));
  return query select true, 'Rol actualizado correctamente.';
end;
$$;
