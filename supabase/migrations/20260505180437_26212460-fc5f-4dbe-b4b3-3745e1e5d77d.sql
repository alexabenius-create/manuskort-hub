
-- Server-side enforcement of manuscript limits per tier.
-- Existing rows are NOT touched; only new inserts are checked.

CREATE OR REPLACE FUNCTION public.enforce_manuscript_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier app_role;
  v_count integer;
  v_limit integer;
BEGIN
  v_tier := public.get_user_tier(NEW.user_id);

  IF v_tier = 'free' THEN
    v_limit := 2;
  ELSE
    -- pro and admin: unlimited
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.manuscripts
  WHERE user_id = NEW.user_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'manuscript_limit_reached: free tier allows max % manuscripts', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_manuscript_limit_trigger ON public.manuscripts;
CREATE TRIGGER enforce_manuscript_limit_trigger
BEFORE INSERT ON public.manuscripts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_manuscript_limit();

-- Harden import_manuscript RPC: also block free-tier docx import on the server.
CREATE OR REPLACE FUNCTION public.import_manuscript(p_manuscript jsonb, p_panelists jsonb, p_cards jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_tier app_role;
  v_manuscript_id uuid;
  v_panelist jsonb;
  v_panelist_id uuid;
  v_temp_to_real jsonb := '{}'::jsonb;
  v_temp_id text;
  v_card jsonb;
  v_html text;
  v_pos integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_tier := public.get_user_tier(v_user);
  if v_tier = 'free' then
    raise exception 'import_requires_pro: document import is a PRO feature';
  end if;

  insert into public.manuscripts (
    user_id, title, mode, text_size, target_duration_seconds, wpm, tags
  ) values (
    v_user,
    coalesce(p_manuscript->>'title', 'Importerat manus'),
    coalesce((p_manuscript->>'mode')::manuscript_mode, 'speaker'::manuscript_mode),
    coalesce(p_manuscript->>'text_size', 'md'),
    nullif(p_manuscript->>'target_duration_seconds','')::integer,
    coalesce((p_manuscript->>'wpm')::integer, 140),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(coalesce(p_manuscript->'tags','[]'::jsonb))),
      '{}'::text[]
    )
  )
  returning id into v_manuscript_id;

  v_pos := 0;
  for v_panelist in select * from jsonb_array_elements(coalesce(p_panelists,'[]'::jsonb))
  loop
    insert into public.panelists (manuscript_id, user_id, name, color, position)
    values (
      v_manuscript_id,
      v_user,
      coalesce(v_panelist->>'name',''),
      coalesce(v_panelist->>'color','#F5D76E'),
      v_pos
    )
    returning id into v_panelist_id;

    v_temp_id := v_panelist->>'tempId';
    if v_temp_id is not null then
      v_temp_to_real := v_temp_to_real || jsonb_build_object(v_temp_id, v_panelist_id::text);
    end if;
    v_pos := v_pos + 1;
  end loop;

  v_pos := 0;
  for v_card in select * from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb))
  loop
    v_html := coalesce(v_card->>'content_html','');
    for v_temp_id in select jsonb_object_keys(v_temp_to_real)
    loop
      v_html := replace(
        v_html,
        'data-panelist-id="' || v_temp_id || '"',
        'data-panelist-id="' || (v_temp_to_real->>v_temp_id) || '"'
      );
    end loop;

    insert into public.cards (
      manuscript_id, user_id, position, role, title, content_html,
      notes, start_time, end_time, cue_red, cue_amber, cue_teal, is_panic_card
    ) values (
      v_manuscript_id,
      v_user,
      coalesce((v_card->>'position')::integer, v_pos),
      coalesce((v_card->>'role')::card_role, 'speaker'::card_role),
      coalesce(v_card->>'title',''),
      v_html,
      coalesce(v_card->>'notes',''),
      coalesce(v_card->>'start_time',''),
      coalesce(v_card->>'end_time',''),
      coalesce(v_card->>'cue_red',''),
      coalesce(v_card->>'cue_amber',''),
      coalesce(v_card->>'cue_teal',''),
      coalesce((v_card->>'is_panic_card')::boolean, false)
    );
    v_pos := v_pos + 1;
  end loop;

  return v_manuscript_id;
end;
$function$;
