

## Plan: Fix H1 mellanslag-bugg

### Problem
H1 i `src/pages/Landing.tsx` (rad 157-160):
```jsx
<h1>
  Tala tryggt.
  <br />
  <span>Håll tiden. Varje&nbsp;gång.</span>
</h1>
```

`innerText` blir `"Tala tryggt.\nHåll tiden. Varje gång."` — men i textrepresentation utan radbrytning blir det `"Tala tryggt.Håll tiden..."` (ingen mellanslag före `<br>`).

### Fix
Lägg till ett mellanslag efter `Tala tryggt.` så textnoden blir `"Tala tryggt. "`:

```jsx
<h1 ...>
  Tala tryggt.{" "}
  <br />
  <span className="text-muted-foreground">Håll tiden. Varje&nbsp;gång.</span>
</h1>
```

Detta motsvarar exakt det användaren bett om: `<h1>Tala tryggt. <br>Håll tiden. Varje gång.</h1>`.

### Filer
- `src/pages/Landing.tsx` — rad 157-161 (en liten edit).

### Verifiering efter deploy
Kör i konsolen:
```js
document.querySelector('h1').innerText
```
Ska returnera:
```
Tala tryggt. 
Håll tiden. Varje gång.
```
(två rader, mellanslag efter första punkten).

