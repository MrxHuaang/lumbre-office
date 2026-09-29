import { z } from "zod";

/**
 * Avisos de GitHub (webhook → chat global). La web verifica la firma y arma el texto con estas reglas;
 * el servidor de juego solo lo reparte como aviso del sistema (`SystemNotice`).
 */

/** Qué acciones de un PR se anuncian: "merged" (al mezclarse) y/o "opened" (al abrirse o salir de borrador). */
export const GITHUB_NOTICE_KINDS = ["opened", "merged"] as const;
export type GithubNoticeKind = (typeof GITHUB_NOTICE_KINDS)[number];

/** Si no se configura nada, solo se anuncian los PR mezclados (lo que pide el issue). */
export const DEFAULT_GITHUB_NOTICE_KINDS: readonly GithubNoticeKind[] = ["merged"];

/** Lee `GITHUB_WEBHOOK_EVENTS` ("merged", "opened,merged"…); lo que no reconoce se ignora. */
export function parseGithubNoticeKinds(raw: string | undefined): Set<GithubNoticeKind> {
  const kinds = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is GithubNoticeKind => (GITHUB_NOTICE_KINDS as readonly string[]).includes(s));
  return new Set(kinds.length ? kinds : DEFAULT_GITHUB_NOTICE_KINDS);
}

/** Aviso del sistema que la web le pide al servidor de juego repartir por el chat global. */
export const SystemNotice = z.object({
  /** Nombre que se ve como autor ("GitHub"). */
  from: z.string().trim().min(1).max(24),
  text: z.string().trim().min(1).max(500),
});
export type SystemNotice = z.infer<typeof SystemNotice>;

/** Lo mínimo que se lee del evento `pull_request` de GitHub (el resto del payload se ignora). */
const PullRequestEvent = z.object({
  action: z.string(),
  pull_request: z.object({
    number: z.number().int(),
    title: z.string(),
    merged: z.boolean().nullish(),
    draft: z.boolean().nullish(),
    user: z.object({ login: z.string() }).nullish(),
    merged_by: z.object({ login: z.string() }).nullish(),
    base: z.object({ ref: z.string() }).nullish(),
  }),
  repository: z.object({ name: z.string() }).nullish(),
  sender: z.object({ login: z.string() }).nullish(),
});

/** Largo máximo del título en el aviso: el chat es angosto. */
const TITLE_MAX = 90;

function shortTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
}

/**
 * Texto del aviso para un evento del webhook, o null si no hay que anunciar nada
 * (otro tipo de evento, un PR cerrado sin mezclar, un borrador o una acción no configurada).
 */
export function githubPullNotice(event: string, payload: unknown, kinds: ReadonlySet<GithubNoticeKind>): SystemNotice | null {
  if (event !== "pull_request") return null;
  const parsed = PullRequestEvent.safeParse(payload);
  if (!parsed.success) return null;
  const { action, pull_request: pr, repository, sender } = parsed.data;
  const where = repository ? ` en ${repository.name}` : "";
  const what = `el PR #${pr.number} «${shortTitle(pr.title)}»${where}`;

  if (action === "closed" && pr.merged && kinds.has("merged")) {
    const who = pr.merged_by?.login ?? sender?.login ?? "Alguien";
    const into = pr.base?.ref ? ` a ${pr.base.ref}` : "";
    return { from: "GitHub", text: `${who} mezcló ${what}${into}.` };
  }
  // "ready_for_review" cuenta como abrirse: el borrador recién se muestra al equipo.
  if ((action === "opened" || action === "reopened" || action === "ready_for_review") && !pr.draft && kinds.has("opened")) {
    const who = pr.user?.login ?? sender?.login ?? "Alguien";
    const verb = action === "reopened" ? "reabrió" : "abrió";
    return { from: "GitHub", text: `${who} ${verb} ${what}.` };
  }
  return null;
}
