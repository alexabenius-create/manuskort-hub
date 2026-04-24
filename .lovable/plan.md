## Ny status "Åtgärdas ej" för insikter

### 1. Migration
Uppdatera `validate_admin_insight()` så `status` accepterar `'wont_fix'`:
```sql
CREATE OR REPLACE FUNCTION public.validate_admin_insight()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.source NOT IN ('email','call','dm','own','meeting','other') THEN
    RAISE EXCEPTION 'Invalid source: %', NEW.source;
  END IF;
  IF NEW.priority NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('new','processing','ready','implemented','wont_fix','archived') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
```

### 2. `src/components/admin/insights/types.ts`
- Lägg till `"wont_fix"` i `InsightStatus`-unionen.
- `STATUS_LABEL.wont_fix = "Åtgärdas ej"`.

### 3. `src/components/admin/insights/InsightsPanel.tsx`
- Lägg till `{ key: "wont_fix", label: STATUS_LABEL.wont_fix }` i `STATUS_FILTERS`.
- I `filtered`: när `filter === "all"`, exkludera insikter med `status === "wont_fix"`.
- I `statusCounts`: räkna `all` som antal insikter där `status !== "wont_fix"`; räkna `wont_fix` separat.

### 4. `src/components/admin/insights/InsightDetail.tsx`
Inga ändringar krävs — status-väljaren itererar redan över `STATUS_LABEL`-nycklarna, så `wont_fix` blir automatiskt valbart när det läggs till där.

### Resultat
- Ny statusflik "Åtgärdas ej" syns i sidofiltret med egen räknare.
- Insikter med denna status visas inte under "Alla" — bara när man aktivt väljer fliken.
- Befintliga insikter påverkas inte.
