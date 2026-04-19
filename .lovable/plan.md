
Auth-loggarna visar tydligt:

1. `/recover` (glömt lösenord) → `hook_timeout` mot `https://api.lovable.dev/projects/.../backend/email-hook` (5s timeout, 422)
2. `/otp` (magisk länk) → samma `hook_timeout`
3. `/signup` → samma `hook_timeout`
4. `/token` (login) fungerar dock direkt (200 vid lyckad inloggning, 400 vid fel lösenord)

Trots att jag tidigare körde `email_domain--toggle_project_emails` med `enabled: false`, så är hook:en fortfarande aktiv och timeoutar. Det betyder att toggle-anropet antingen inte faktiskt avregistrerade Auth-hook:en, eller att hook:en återaktiverats. Resultat: alla flöden som skickar mejl (signup, magisk länk, glömt lösenord) misslyckas med 422.

Inloggning med befintligt konto + lösenord fungerar (token-endpointen rör inte hook:en). Auto-confirm är på, så signup *skulle* fungera om hook:en inte timeoutade — men eftersom GoTrue väntar på hook:en innan svar returneras, faller hela signup-anropet på 422.

## Plan

1. **Försök stänga av Lovable Emails igen** via `email_domain--toggle_project_emails` (`enabled: false`) och verifiera att hook:en faktiskt försvinner från Auth-config.
2. **Kontrollera domänstatus** med `email_domain--check_email_domain_status` för att förstå om en halvkonfigurerad domän/hook ligger kvar.
3. **Om hook:en fortfarande triggas efter toggle:** scaffolda om auth-email-hook korrekt (`email_domain--scaffold_auth_email_templates` + deploy), så att hook:en svarar inom 5s istället för att timeouta. Det är troligen rätt långsiktig lösning eftersom du vill ha custom auth-mejl framöver.
4. **Verifiera** genom att titta på nya auth-loggar efter åtgärd att `/signup`, `/otp` och `/recover` returnerar 200 istället för 422.

Inga kodändringar i projektet behövs — felet ligger uteslutande i backend-konfigurationen för Auth-mejlhooken.
