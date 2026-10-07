import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const BIN = process.env.YTDLP_PATH || "yt-dlp";
const ENV = { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" };

export type VideoMeta = {
  title: string;
  description: string;
  thumbnail: string | null;
  platform: string;
};

export async function getMeta(url: string): Promise<VideoMeta> {
  const { stdout } = await run(
    BIN,
    ["--dump-json", "--no-playlist", "--skip-download", url],
    { maxBuffer: 20 * 1024 * 1024, timeout: 60_000, env: ENV }
  );
  const m = JSON.parse(stdout);
  return {
    title: m.title ?? "",
    description: m.description ?? "",
    thumbnail: m.thumbnail ?? null,
    platform: String(m.extractor_key ?? "").toLowerCase(),
  };
}

export type VideoComment = {
  text: string;
  like_count: number;
  is_pinned: boolean;
  by_uploader: boolean;
};

export async function getComments(url: string): Promise<VideoComment[]> {
  const { stdout } = await run(
    BIN,
    [
      "--dump-json",
      "--no-playlist",
      "--skip-download",
      "--write-comments",
      "--extractor-args",
      "youtube:max_comments=30,30,0,0;comment_sort=top",
      url,
    ],
    { maxBuffer: 50 * 1024 * 1024, timeout: 90_000, env: ENV }
  );
  const m = JSON.parse(stdout);
  const list: any[] = Array.isArray(m.comments) ? m.comments : [];
  return list
    .filter((c) => !c.parent || c.parent === "root")
    .map((c) => ({
      text: String(c.text ?? ""),
      like_count: Number(c.like_count ?? 0),
      is_pinned: Boolean(c.is_pinned),
      by_uploader: Boolean(c.author_is_uploader),
    }))
    .filter((c) => c.text.trim().length > 0);
}

export function commentsToText(comments: VideoComment[]): string {
  const special = comments
    .filter((c) => c.is_pinned || c.by_uploader)
    .map((c) => ({
      label: c.is_pinned ? "[PŘIPNUTÝ KOMENTÁŘ]" : "[KOMENTÁŘ AUTORA VIDEA]",
      text: c.text,
    }));
  const top = comments
    .filter((c) => !c.is_pinned && !c.by_uploader)
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, 5)
    .map((c) => ({ label: "[KOMENTÁŘ]", text: c.text }));

  return [...special, ...top]
    .slice(0, 8)
    .map((c) => `${c.label}\n${c.text.slice(0, 3000)}`)
    .join("\n\n---\n\n");
}

export type FriendlyError = { message: string; status: number };

export function explainYtdlpError(e: unknown): FriendlyError {
  const err = e as {
    code?: string | number;
    killed?: boolean;
    signal?: string;
    stderr?: string;
    message?: string;
  };
  const text = `${err?.stderr ?? ""}\n${err?.message ?? ""}`.toLowerCase();

  if (err?.code === "ENOENT") {
    return {
      status: 500,
      message:
        "Na serveru se nepodařilo spustit yt-dlp. Zkontrolujte, že je nainstalované (nebo nastavte YTDLP_PATH v .env.local).",
    };
  }
  if (err?.killed || err?.signal === "SIGTERM") {
    return {
      status: 504,
      message: "Načítání videa trvalo příliš dlouho. Zkuste to prosím znovu.",
    };
  }
  if (text.includes("unsupported url")) {
    return {
      status: 400,
      message:
        "Zkontrolujte odkaz: nevypadá jako odkaz na video (YouTube, TikTok, Instagram…).",
    };
  }
  if (text.includes("http error 404")) {
    return {
      status: 400,
      message: "Zkontrolujte odkaz: na této adrese nic není.",
    };
  }
  if (/private|unavailable|removed|deleted|not available|members-only|age-restricted|copyright/.test(text)) {
    return {
      status: 422,
      message:
        "Video je soukromé, smazané nebo není dostupné. Zkontrolujte odkaz, případně recept přidejte ručně.",
    };
  }
  if (/sign in|log in|login|cookies|rate-limit|not a bot|http error 403|forbidden|http error 429|too many requests/.test(text)) {
    return {
      status: 502,
      message:
        "Platforma teď video nevydala (vyžaduje přihlášení nebo načítání omezila). Zkuste to později, nebo recept přidejte ručně.",
    };
  }
  if (/unable to download|getaddrinfo|name resolution|timed out|connection|urlopen error|unreachable/.test(text)) {
    return {
      status: 502,
      message:
        "Nepodařilo se spojit s webem. Zkontrolujte připojení k internetu a zkuste to znovu.",
    };
  }
  return {
    status: 502,
    message:
      "Video se nepodařilo načíst. Zkontrolujte odkaz, případně recept přidejte ručně.",
  };
}