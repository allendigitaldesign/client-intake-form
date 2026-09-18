# Client intake questionnaire

A one-page questionnaire I send to a new web-design client. They open the link
on their phone, answer what they can, upload their logo and photos, and hit
send. The answers and the files arrive in my inbox.

Built to be reused: the questions live in one file, and nothing else needs
touching to run it for the next client.

- **Live form:** https://allendigitaldesign.github.io/client-intake-form/
- **Supabase project:** `client-intake-forms` (`nbcqybbaeygqhxwfqidq`)
- **Repo:** `allendigitaldesign/client-intake-form` (public, so free Pages works)

---

## How it works

```
Phone browser
   |
   |  1. each file, straight up as it's picked (XHR, shows progress)
   +-------------------------------> Supabase Storage  "intake-uploads"
   |                                  private bucket, 30 MB a file
   |
   |  2. on send: the answers + the list of file paths
   +-------------------------------> Edge function "submit-intake"
                                         |
                                         +-- saves a row in `submissions`
                                         +-- makes a 1-year signed link per file
                                         +-- emails the lot via Resend
```

Files go **straight from the phone to storage**, not through the function.
That's the reason this works with 25 MB photos: it sidesteps the request-body
limits that make Formspree, Netlify Forms and Vercel functions choke on them.

The answers are saved to the database **before** the email is attempted, so a
mail outage can never lose a submission — worst case the email fails and the
row is still there with `emailed = false` and the reason in `email_error`.

---

## Changing the questions for the next client

Everything you need is in **`assets/questions.js`**. Nothing else.

1. Open `assets/questions.js`.
2. Edit `title`, `intro` and the `confirmation` wording at the top.
3. Edit the `sections` list. Each section is:

```js
{
  id: "photos",              // short, unique, no spaces
  number: "2",               // the big red numeral; use null for no number
  heading: "Photos of the gym",
  blurb: "Why I'm asking.",  // optional; omit or null for none
  fields: [ ... ]
}
```

4. Each field is one of four types:

```js
{ id: "gym_name", type: "text",     label: "Gym name", placeholder: "..." }
{ id: "hours",    type: "textarea", label: "Opening hours", hint: "..." }
{ id: "has_logo", type: "radio",    label: "Do you have a logo?",
                  options: ["Yes", "No"] }
{ id: "photos",   type: "files",    label: "Photos", note: "..." }
```

`hint` sits under the label in grey. `note` does the same for upload boxes.

5. Change `storageKey` in `assets/config.js` to something new, e.g.
   `"add-intake:smith-bakery:v1"`. **Don't skip this** — it's what keeps one
   client's half-finished answers from showing up in another's form on a
   shared device.
6. Commit and push (see below).

Rules worth knowing:

- **`id` must be unique across the whole form** and shouldn't change once a
  client has started — it's the localStorage key for that answer.
- Every question is optional by design. A partial form can always be sent.
- The progress counter counts every non-`files` field automatically. Add three
  questions and it says "of 33" on its own.
- Keep the `id` **`gym_name`** on whichever field is the client's business
  name — the email subject line uses it. Otherwise the subject is generic.

---

## Deploying

The site is plain static files. There is no build step.

```bash
git add -A && git commit -m "Update questions" && git push
```

GitHub Pages redeploys in about a minute.

Pages is already on: branch `main`, folder `/ (root)`. The repo is public,
which is what makes Pages free.

## Email setup

You need one thing: a Resend API key. No domain, no DNS.

1. Sign up at resend.com using **allendigitaldesignco@gmail.com**.
2. **API Keys -> Create API Key.** Copy it.
3. Supabase -> **client-intake-forms** -> Settings -> Edge Functions -> Secrets.
   Add `RESEND_API_KEY`. No redeploy needed.

That's done and working.

### Why the email has no download links

Resend's shared `onboarding@resend.dev` sender silently drops any message
carrying a storage link. Measured on 2026-09-18:

| Email | Result |
|---|---|
| Answers only, no links | Delivered |
| Answers + 1 signed download link | Accepted by Resend, never arrived |
| Answers + 7 signed download links | Accepted by Resend, never arrived |
| Answers + 2 files, links removed | Delivered |

Not spam, not trash, no errors — Resend returns HTTP 200 and the message
disappears. So the email lists the filenames and tells you the folder, and you
pick the photos up from Supabase -> Storage -> intake-uploads -> the reference
id in the email.

**`emailed = true` means Resend accepted it, not that it arrived.** That's the
trap this table exists to document.

### Turning download links back on (optional)

Only worth doing if the Storage step gets annoying. Verify a domain you own at
**resend.com/domains** (it gives you 3-4 DNS records), then add a second
Supabase secret:

- `FROM_EMAIL` = `Client questionnaire <forms@yourdomain.com>`

The function watches for `FROM_EMAIL`. The moment it's set, it goes back to
putting one-year signed download links straight in the email. Nothing else to
change.

### Secrets

| Secret | Default | Notes |
|---|---|---|
| `RESEND_API_KEY` | — | Required. |
| `TO_EMAIL` | `allendigitaldesignco@gmail.com` | Where submissions go. |
| `FROM_EMAIL` | unset | Set it only with a verified domain. Setting it re-enables download links. |

## Where submissions live

Every submission is a row in the `submissions` table, whether or not the email
went out. To see them: Supabase dashboard → **Table Editor** → `submissions`.
Useful when an email goes missing:

```sql
select created_at, form_title, answered_count, emailed, email_error
from submissions
order by created_at desc;
```

`emailed = false` with something in `email_error` means the answers are safe
and only the email failed — usually a missing or expired Resend key.

Files are in **Storage → intake-uploads**, foldered by submission id. The
email's download links are signed and last a year; save anything you want to
keep past that.

---

## Security notes

Worth reading before changing anything in the Supabase project.

- The bucket is **private** and anonymous visitors have exactly one permission:
  `INSERT`. They cannot read, list, overwrite or delete — verified by test.
  This matters because the publishable key ships in the browser, so anyone with
  the form link has it.
- `submissions` has **RLS on with no policies**, and no table grants for `anon`
  or `authenticated`. Only the edge function's service role can touch it.
- Supabase's linter flags this as **"RLS Enabled No Policy"**. That warning is
  expected and correct here — *don't* add a policy to silence it. Adding one
  would open the table up.
- The function ignores any file path that isn't under the submitting form's own
  folder, so a tampered request can't attach someone else's upload to its
  email.
- The honeypot is a hidden `website` field. Bots fill it; the function then
  returns success and quietly throws the submission away.
- The table lives in the `public` schema on purpose. A custom schema needs the
  "Exposed schemas" API setting, which can be reset in the dashboard and would
  silently break every submission.

---

## Files

```
index.html                              page shell
assets/questions.js                     THE QUESTIONS — edit this one
assets/config.js                        Supabase URL, key, storage key
assets/styles.css                       all styling, light + dark
assets/app.js                           rendering, autosave, uploads, submit
supabase/migrations/001_intake.sql      table, bucket, policies, grants
supabase/functions/submit-intake/       the edge function
```

## Running it locally

```bash
npx serve -l 4178 .
```

Then open `http://localhost:4178`. It talks to the real Supabase project, so
anything you submit while testing lands in the real table — delete the test
rows afterwards.
