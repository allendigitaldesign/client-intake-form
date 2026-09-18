// ---------------------------------------------------------------------------
// submit-intake
//
// Takes the finished questionnaire, stores it, turns each uploaded file into a
// long-lived signed link, and emails the lot to the studio address.
//
// Environment variables (set these in the Supabase dashboard):
//   RESEND_API_KEY   required — the key from resend.com
//   TO_EMAIL         optional — defaults to allendigitaldesignco@gmail.com
//   FROM_EMAIL       optional — defaults to Resend's shared sending address
// ---------------------------------------------------------------------------

import { createClient } from "jsr:@supabase/supabase-js@2";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // one year

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Answer = { section: string; id: string; label: string; value: string };
type FileRef = {
  section: string;
  field: string;
  name: string;
  size: number;
  type: string;
  path: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- email building ---------------------------------------------------------

function buildHtml(
  formTitle: string,
  submissionId: string,
  answers: Answer[],
  files: (FileRef & { url?: string })[],
  answeredCount: number,
  questionCount: number,
): string {
  const ink = "#1F1A17";
  const muted = "#6B635C";
  const accent = "#A32A22";
  const rule = `border-top:1px solid #DDD6C9;`;

  // Headline answer, if they gave one, makes the email scannable in the list.
  const gymName =
    answers.find((a) => a.id === "gym_name")?.value?.trim() || "";

  const sections: string[] = [];
  let current = "";
  let buf: string[] = [];

  const flush = () => {
    if (!current || buf.length === 0) return;
    sections.push(`
      <tr><td style="padding:26px 0 0;">
        <div style="font:700 12px/1.4 Arial,sans-serif;letter-spacing:.12em;
                    text-transform:uppercase;color:${accent};">${esc(current)}</div>
        <div style="${rule}margin:8px 0 0;"></div>
        ${buf.join("")}
      </td></tr>`);
    buf = [];
  };

  for (const a of answers) {
    if (a.section !== current) {
      flush();
      current = a.section;
    }
    buf.push(`
      <div style="margin:14px 0 0;">
        <div style="font:700 14px/1.4 Arial,sans-serif;color:${ink};">${esc(a.label)}</div>
        <div style="font:400 15px/1.55 Arial,sans-serif;color:${ink};
                    white-space:pre-wrap;margin-top:3px;">${esc(a.value)}</div>
      </div>`);
  }
  flush();

  const fileRows = files
    .map((f) => {
      const label = `${esc(f.name)} <span style="color:${muted};">(${esc(
        formatBytes(f.size),
      )})</span>`;
      const link = f.url
        ? `<a href="${esc(f.url)}" style="color:${accent};font-weight:700;
             text-decoration:underline;">Download</a>`
        : `<span style="color:${muted};">link unavailable</span>`;
      return `
        <tr>
          <td style="padding:8px 12px 8px 0;font:400 14px/1.4 Arial,sans-serif;
                     border-top:1px solid #DDD6C9;">${label}
            <div style="color:${muted};font-size:12px;">${esc(f.field)}</div>
          </td>
          <td style="padding:8px 0;font:400 14px/1.4 Arial,sans-serif;
                     border-top:1px solid #DDD6C9;text-align:right;
                     white-space:nowrap;">${link}</td>
        </tr>`;
    })
    .join("");

  const filesBlock = files.length
    ? `<tr><td style="padding:26px 0 0;">
         <div style="font:700 12px/1.4 Arial,sans-serif;letter-spacing:.12em;
                     text-transform:uppercase;color:${accent};">
           Files &middot; ${files.length}</div>
         <table cellpadding="0" cellspacing="0" border="0" width="100%"
                style="margin-top:6px;">${fileRows}</table>
         <div style="font:400 12px/1.5 Arial,sans-serif;color:${muted};margin-top:10px;">
           Links are good for one year. Save anything you want to keep.</div>
       </td></tr>`
    : `<tr><td style="padding:26px 0 0;font:400 14px/1.5 Arial,sans-serif;
         color:${muted};">No files were uploaded.</td></tr>`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#EFEBE3;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:#EFEBE3;padding:28px 16px;">
<tr><td align="center">
  <table cellpadding="0" cellspacing="0" border="0" width="100%"
         style="max-width:640px;background:#FAF8F4;border:1px solid #DDD6C9;
                border-radius:3px;padding:26px;">
    <tr><td>
      <div style="font:700 12px/1.4 Arial,sans-serif;letter-spacing:.14em;
                  text-transform:uppercase;color:${muted};">New submission</div>
      <div style="font:700 26px/1.2 Arial,sans-serif;color:${ink};margin-top:6px;">
        ${esc(gymName || formTitle)}</div>
      <div style="font:400 14px/1.5 Arial,sans-serif;color:${muted};margin-top:6px;">
        ${answeredCount} of ${questionCount} questions answered &middot;
        ${files.length} file${files.length === 1 ? "" : "s"} &middot;
        ${esc(new Date().toUTCString())}</div>
    </td></tr>
    ${filesBlock}
    ${sections.join("")}
    <tr><td style="padding:26px 0 0;">
      <div style="${rule}margin-bottom:10px;"></div>
      <div style="font:400 12px/1.5 Arial,sans-serif;color:${muted};">
        Reference ${esc(submissionId)}<br>
        Allen Digital Design Co. client questionnaire</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function buildText(
  formTitle: string,
  submissionId: string,
  answers: Answer[],
  files: (FileRef & { url?: string })[],
): string {
  const lines: string[] = [formTitle, `Reference: ${submissionId}`, ""];

  if (files.length) {
    lines.push("== FILES ==");
    for (const f of files) {
      lines.push(`- ${f.name} (${formatBytes(f.size)}) [${f.field}]`);
      lines.push(`  ${f.url ?? "link unavailable"}`);
    }
    lines.push("");
  }

  let current = "";
  for (const a of answers) {
    if (a.section !== current) {
      current = a.section;
      lines.push(`== ${current.toUpperCase()} ==`);
    }
    lines.push(`${a.label}:`);
    lines.push(a.value);
    lines.push("");
  }
  return lines.join("\n");
}

// --- handler ----------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Malformed request" }, 400);
  }

  // Honeypot. A bot filled the hidden field — accept and discard.
  if (typeof payload.website === "string" && payload.website.trim() !== "") {
    return json({ ok: true });
  }

  const submissionId = String(payload.submissionId ?? "");
  if (!UUID_RE.test(submissionId)) {
    return json({ error: "Bad submission id" }, 400);
  }

  const formTitle = String(payload.formTitle ?? "Client questionnaire");
  const answers = (Array.isArray(payload.answers) ? payload.answers : []) as Answer[];
  const rawFiles = (Array.isArray(payload.files) ? payload.files : []) as FileRef[];
  const answeredCount = Number(payload.answeredCount ?? answers.length);
  const questionCount = Number(payload.questionCount ?? answers.length);

  if (answers.length === 0 && rawFiles.length === 0) {
    return json({ error: "Nothing was filled in" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Only trust file paths that sit under this submission's own folder.
  const files = rawFiles.filter((f) =>
    typeof f.path === "string" && f.path.startsWith(`${submissionId}/`)
  );

  // Store first: whatever happens to the email, the answers are safe.
  const { error: insertError } = await supabase
    .from("submissions")
    .upsert({
      id: submissionId,
      form_title: formTitle,
      answers,
      files,
      answered_count: answeredCount,
      question_count: questionCount,
      user_agent: req.headers.get("user-agent"),
      started_at: payload.startedAt ?? null,
    });

  if (insertError) {
    console.error("insert failed", insertError);
    return json({ error: "Could not save the submission" }, 500);
  }

  // Signed links for each upload.
  const signed: (FileRef & { url?: string })[] = [];
  for (const f of files) {
    const { data, error } = await supabase.storage
      .from("intake-uploads")
      .createSignedUrl(f.path, SIGNED_URL_TTL);
    if (error) console.error("sign failed", f.path, error.message);
    signed.push({ ...f, url: data?.signedUrl });
  }

  // Email it over.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const toEmail = Deno.env.get("TO_EMAIL") ?? "allendigitaldesignco@gmail.com";
  const fromEmail = Deno.env.get("FROM_EMAIL") ??
    "Client questionnaire <onboarding@resend.dev>";

  let emailed = false;
  let emailError: string | null = null;

  if (!resendKey || !toEmail) {
    emailError = "RESEND_API_KEY or TO_EMAIL is not set";
    console.error(emailError);
  } else {
    const gymName = answers.find((a) => a.id === "gym_name")?.value?.trim();
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: gymName
            ? `Questionnaire: ${gymName}`
            : `Questionnaire: new submission`,
          html: buildHtml(
            formTitle, submissionId, answers, signed, answeredCount, questionCount,
          ),
          text: buildText(formTitle, submissionId, answers, signed),
        }),
      });
      if (res.ok) {
        emailed = true;
      } else {
        emailError = `Resend ${res.status}: ${await res.text()}`;
        console.error(emailError);
      }
    } catch (e) {
      emailError = String(e);
      console.error("email threw", emailError);
    }
  }

  await supabase
    .from("submissions")
    .update({ emailed, email_error: emailError })
    .eq("id", submissionId);

  // The answers are stored either way, so the visitor sees success.
  return json({ ok: true, emailed, files: signed.length });
});
