# Rotating `PAYLOAD_PIN_PEPPER`

> ## ⛔ DO NOT FOLLOW THIS PROCEDURE YET — corrections pending (2026-09-04)
>
> Two things this document was written on top of turned out to be wrong. The
> *analysis* of what the pepper protects still stands; the **procedure does not**.
>
> 1. **It describes PIN storage that no longer exists.** `Users.pin` is now
>    virtual and write-only; what persists is `pinLookup`, an HMAC under a
>    separate label (`lib/pin.ts`, `test/pin-storage.test.ts`). Every step below
>    that reads a PIN out of MongoDB to re-derive it **cannot work** — that is the
>    point of the change, and it makes rotation strictly harder, not easier.
> 2. **It assumes writing a PIN changes the credential.** In Payload 3.85.1 a
>    password assigned in a collection `beforeChange` hook is dead code on
>    update — the value is snapshotted before those hooks run. Until
>    `hooks/pin-credential.ts` (added 2026-09-04) no PIN change through any path
>    had ever moved the credential. Any rotation step that "just re-saves each
>    user" would have reported success and changed nothing.
>
> **What rotation now actually costs.** With the PIN no longer recoverable from
> the database, a new pepper invalidates every derived password AND every stored
> lookup, and nothing on the server can reproduce them. Rotation therefore means
> **every member of staff is issued a new PIN** — it is a credential reset for the
> whole team, not a background key change. That is a scheduling decision, not a
> deploy step, and this document needs rewriting around it before anyone runs it.
>
> Still true and still worth acting on: the pepper is 4 characters against a
> documented minimum of 16, and `derivePassword` is a single HMAC over a
> 10,000-candidate space, so the pepper is the entire secret.


Written 2026-09-04 after the production check found the pepper is **4 characters**
against a documented minimum of 16 (`deploy/README.md`).

**Read the first section before doing this.** Rotation is a genuine lockout risk
and, on its own, buys less than it appears to.

---

## 1. What the pepper actually protects — and what it does not

Staff sign in with a 4-digit PIN. There is no separate password:

```
apps/dashboard/src/lib/pin.ts
  derivePassword(pin) = HMAC-SHA256(PEPPER, "metnmat:pin:" + pin)  → hex

apps/dashboard/src/collections/Users.ts  (beforeChange)
  if (data.pin) data.password = derivePassword(String(data.pin));
```

So the Payload password is a deterministic function of the PIN and the pepper.

**The PIN itself is stored in cleartext.** `Users.ts` declares it as

```ts
{ name: "pin", type: "text", maxLength: 4, index: true,
  access: { read: fieldSuperAdmin, create: fieldSuperAdmin, update: fieldSuperAdmin } }
```

That access control is enforced by Payload at the **API** layer. The value in
MongoDB is the four digits, in the clear, in the same document as the password
hash — and indexed, because `ensureDirectorAccount` and the uniqueness check
both query `where: { pin: { equals: pin } }`.

The consequence is worth stating plainly:

> Anyone who can read the `users` collection already has every staff PIN. They do
> not need the pepper, do not need to reverse a hash, and do not need to brute
> force 10,000 combinations — they can read the credential and type it into the
> login form.

So a longer pepper does **not** meaningfully improve resistance to database
compromise, which is the threat that matters here. What it does improve is
narrower: an attacker holding only the derived `password` value (say from a
backup of a different shape, or a log) cannot invert it to a PIN. That is real
but secondary.

**Priority recommendation.** Storing the PIN in cleartext is the larger problem
and the one to fix first. Rotating a 4-character pepper while the PIN sits beside
it in plaintext is tidying the lock while the key is taped to the door. The
rotation below is documented because it was asked for and because a 4-character
HMAC key is genuinely substandard — but it should not be mistaken for the fix.

---

## 2. Why rotation is dangerous here

Change the pepper and **every stored password becomes wrong at once**, because
each was derived under the old one. The next boot leaves *nobody* able to sign
in — not staff, not the director. There is no email-and-password fallback: the
"Admin recovery sign-in" link expects the same derived hex string, which is not
something a human can type.

Recovery from that state requires either restoring the old pepper or reaching the
database directly. Do not begin without the rollback step understood.

---

## 3. Precondition — a migration must exist BEFORE the pepper changes

Nothing in the codebase re-derives passwords today. Rotating without this step
is the lockout described above.

The migration is possible only because the PIN is stored in cleartext (§1): for
every user holding a PIN, re-save that PIN so `Users.beforeChange` re-derives the
password **under whichever pepper the running process holds**.

Shape it as follows.

- Runs from `onInit`, in `seed.ts`, so it executes on the boot that first has the
  new pepper — before anyone tries to sign in.
- **Idempotent.** Same PIN plus same pepper yields the same password, so a repeat
  run is a no-op and a partial run is fixed by simply running again. This matters:
  a failure halfway leaves some accounts on the new pepper and some on the old,
  and the cure must be "run it again", not "work out which".
- Gated behind an explicit `PIN_REDERIVE=true`, not left on. It touches every
  staff credential and should be a deliberate act, exactly like
  `DIRECTOR_PIN_FORCE`.
- Uses `overrideAccess: true` and iterates with a real page size; do not assume
  the staff list fits one page.
- Logs a count and never logs a PIN, a pepper or a derived password.

Deploy the migration **first**, on the old pepper, and confirm the CMS is healthy.
On the old pepper it re-derives the same values it already had, so it is a safe
no-op — which is precisely what makes it worth deploying separately.

---

## 4. The rotation, in order

Each step has a verification. Do not proceed past a failed one.

| # | Action | Verify |
|---|---|---|
| 1 | Deploy the re-derive migration (§3), `PIN_REDERIVE` unset | CMS healthy; sign-in still works |
| 2 | Choose the window | Out of hours. Every staff sign-in is down between steps 3 and 5 |
| 3 | Set `metnmat/prod/PAYLOAD_PIN_PEPPER` to ≥32 random chars, and set `PIN_REDERIVE=true` and `DIRECTOR_PIN_FORCE=true` | Secrets Manager shows the new length |
| 4 | Run **Reload an app** for `metnmat-cms`. Secrets are read at **process start**, so a reload is enough — no rebuild | Health check passes |
| 5 | Confirm the boot log shows the re-derive count matching the staff total | `[seed] re-derived N staff PINs` |
| 6 | Sign in with an ordinary staff PIN, then the director's | Both succeed |
| 7 | Unset `PIN_REDERIVE` and `DIRECTOR_PIN_FORCE`, reload again | Sign-in still works; boot log shows `pin preserved` |

Step 7 is not optional. Leaving `DIRECTOR_PIN_FORCE=true` restores the exact bug
fixed in `cf13ae7`: the director's PIN reverting on every restart.

---

## 5. Rollback — and the trap in it

**Before step 5 completes:** restore the previous pepper value in Secrets Manager
and reload. Passwords are still derived from it, so access returns.

**After the re-derive has run:** restoring the old pepper *breaks everyone again*,
because every password now matches the NEW pepper. The rollback is instead:

1. Put the old pepper back **and** keep `PIN_REDERIVE=true`.
2. Reload, so the migration re-derives everything under the old pepper.

In other words, once the migration has run, the pepper and the stored passwords
must always be changed together. Rolling one back alone is what turns a bad
rotation into a total lockout.

Keep the previous pepper value available until step 6 has passed. Do not delete
the old secret version.

---

## 6. What to do instead, or as well

Ranked by value:

1. **Stop storing the PIN in cleartext.** Store only the derived value and
   compare against it. Uniqueness can be enforced on the derived value, since
   the derivation is deterministic. `ensureDirectorAccount`'s
   `where: { pin: { equals: pin } }` lookup would move to the derived value too.
   This is the change that actually protects the credential.
2. **Lengthen the pepper** by the procedure above — worthwhile, but secondary.
3. **Reconsider 4 digits.** Ten thousand possibilities is small; the throttle
   (5 per IP per 15 minutes, 40 global) is currently the only thing making that
   acceptable, and it is per-IP.
4. **Rotate `DIRECTOR_PIN`.** A director PIN was written in plaintext into a
   session notes file, so it should be treated as disclosed regardless of the
   rest of this.

---

## 7. Facts this document rests on

| Claim | Where |
|---|---|
| Password is `HMAC(pepper, "metnmat:pin:" + pin)` | `lib/pin.ts:17` |
| Password re-derived whenever the PIN is written | `collections/Users.ts` beforeChange |
| PIN stored as cleartext text, indexed | `collections/Users.ts`, `name: "pin", type: "text"` |
| Pepper falls back to `PAYLOAD_SECRET`, then a dev default | `lib/pin.ts:13` |
| Secrets are read at process start | `deploy/bin/with-secrets.sh`; hence reload, not rebuild |
| Throttle is 5/IP and 40 global per 15 min | `lib/pin-throttle.ts` |
| Pepper is currently 4 chars; documented minimum is 16 | `diagnose-aws.yml` run 33854626290; `deploy/README.md` |
| Seed no longer overwrites an existing PIN | `cf13ae7`, `lib/director-pin.ts` |
