import { Fragment, type ReactNode } from "react";

/**
 * Markdown mínimo y seguro para respuestas de agentes: párrafos, listas (-, *, 1.), **negrita**,
 * *cursiva*, `código`, bloques ``` y enlaces [texto](url) o URLs sueltas.
 * Construye elementos React (nunca HTML crudo), así que el texto del modelo no puede inyectar nada.
 */
export function MarkdownLite({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) code.push(lines[i++]!);
      i++;
      blocks.push(
        <pre key={key++} className="my-2 overflow-x-auto rounded-lg bg-ink p-2 text-xs">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key++} className={`my-1 space-y-0.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </List>,
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]!) && !lines[i]!.trim().startsWith("```")) {
      para.push(lines[i++]!.replace(/^#{1,6}\s+/, ""));
    }
    blocks.push(
      <p key={key++} className="my-1">
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <>{blocks}</>;
}

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s)]+|\*[^*\s][^*]*\*)/g;

function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const [tok] = m;
    if (m.index! > last) out.push(text.slice(last, m.index));
    last = m.index! + tok.length;
    if (tok.startsWith("**")) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k++} className="rounded bg-ink px-1 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const url = safeUrl(m[2] ?? "");
      out.push(url ? <Link key={k++} href={url}>{label}</Link> : label);
    } else if (tok.startsWith("http")) {
      const url = safeUrl(tok);
      out.push(url ? <Link key={k++} href={url}>{tok}</Link> : tok);
    } else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-words text-lab underline underline-offset-2">
      {children}
    </a>
  );
}
