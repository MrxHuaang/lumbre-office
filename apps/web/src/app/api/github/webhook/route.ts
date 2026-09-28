import { githubPullNotice, parseGithubNoticeKinds } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { publishSystemNotice } from "@/lib/events";
import { validGithubSignature } from "@/lib/github-webhook";

/** GitHub manda payloads de hasta 25 MB; un `pull_request` pesa decenas de KB, así que se corta antes. */
const MAX_BODY = 1024 * 1024;

/**
 * Webhook de GitHub (ver docs/despliegue.md): anuncia en el chat global cuando se mezcla un PR (y, si
 * `GITHUB_WEBHOOK_EVENTS` lo pide, cuando se abre). La firma se valida con `GITHUB_WEBHOOK_SECRET`.
 */
export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Falta GITHUB_WEBHOOK_SECRET en el servidor" }, { status: 503 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return NextResponse.json({ error: "demasiado grande" }, { status: 413 });

  // La firma es sobre el cuerpo crudo: se lee como texto antes de parsear.
  const body = await req.text();
  if (!validGithubSignature(body, req.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") ?? "";
  // GitHub manda un "ping" al crear el webhook: responder bien confirma que la configuración quedó buena.
  if (event === "ping") return NextResponse.json({ ok: true, pong: true });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const notice = githubPullNotice(event, payload, parseGithubNoticeKinds(process.env.GITHUB_WEBHOOK_EVENTS));
  if (!notice) return NextResponse.json({ ok: true, announced: false });
  await publishSystemNotice(notice);
  return NextResponse.json({ ok: true, announced: true });
}
