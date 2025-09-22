import { NextResponse } from "next/server";
import { load, type CheerioAPI } from "cheerio";
import sanitizeHtml from "sanitize-html";

export const runtime = "nodejs";

type Achievement = {
  id: number;
  name: string;
  unlockHtml: string;
  url?: string;
};

const WIKI_BASE = "https://bindingofisaacrebirth.wiki.gg";
const PAGE = "Achievements";
const API_URL = `${WIKI_BASE}/api.php?action=parse&page=${encodeURIComponent(
  PAGE
)}&format=json&prop=text`;

function toAbsoluteHref(href: string): string {
  const h = (href || "").trim();
  if (!h) return h;
  if (h.startsWith("/")) return `${WIKI_BASE}${h}`;
  if (h.startsWith("#")) return `${WIKI_BASE}/wiki/${PAGE}${h}`;
  if (/^(https?:|mailto:)/i.test(h)) return h;
  return `${WIKI_BASE}/${h.replace(/^\/+/, "")}`;
}

function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[:*#().]/g, "")
    .trim();
}

function findColumnIndexes(
  $: CheerioAPI,
  table: any
): { id: number; name: number; unlock: number } | null {
  const headers: string[] = [];
  $(table)
    .find("tr")
    .first()
    .find("th, td")
    .each((_, el) => {
      headers.push(normalizeHeader($(el).text()));
    });

  let idIdx = -1;
  let nameIdx = -1;
  let unlockIdx = -1;

  headers.forEach((h, idx) => {
    if (
      idIdx === -1 &&
      (h === "id" || h === "no" || h === "number" || /^id\b/.test(h))
    ) {
      idIdx = idx;
    }
    if (
      nameIdx === -1 &&
      (h.includes("achievement") ||
        h === "name" ||
        h === "title" ||
        h.includes("achievement name"))
    ) {
      nameIdx = idx;
    }
    if (
      unlockIdx === -1 &&
      (h.includes("unlock method") ||
        h.includes("how to unlock") ||
        h === "unlock" ||
        h.includes("requirement") ||
        h.includes("unlock criteria"))
    ) {
      unlockIdx = idx;
    }
  });

  if (idIdx === -1 || nameIdx === -1 || unlockIdx === -1) return null;
  return { id: idIdx, name: nameIdx, unlock: unlockIdx };
}

/**
 * Choose the "latest" variant line from an unlock cell.
 * Heuristics:
 * - Prefer lines mentioning Repentance/Repentance+ and NOT prefixed with
 *   "except in"/"before"/"prior to".
 * - Otherwise prefer Afterbirth+ then Afterbirth.
 * - Fallback to the last line (the wiki usually lists latest last).
 */
function pickLatestVersionSnippet(html: string): string {
  if (!html) return html;

  const wrap = load(`<div>${html}</div>`);
  const parts: { html: string; text: string }[] = [];

  // Prefer list items if present
  const lis = wrap("li");
  if (lis.length > 0) {
    lis.each((_, el) => {
      const $el = wrap(el);
      parts.push({ html: $el.html() || "", text: $el.text() });
    });
  } else {
    // Split by <br>
    const rawParts = html
      .split(/<br\s*\/?>/gi)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of rawParts) {
      const t = load(p).text();
      parts.push({ html: p, text: t });
    }
  }

  if (parts.length === 0) return html;

  const isExclusion = (t: string) =>
    /(except in|except for|before|prior to|no longer|removed in)/i.test(t);

  const matchRepentance = (t: string) => /\brepentance\+?\b/i.test(t);
  const matchABPlus = (t: string) => /\bafterbirth\s*\+|\bafterbirth\+\b/i.test(t);
  const matchAB = (t: string) => /\bafterbirth\b/i.test(t);

  // 1) Latest Repentance line that isn't an exclusion
  const repCandidates = parts
    .map((p, i) => ({ ...p, i }))
    .filter((p) => matchRepentance(p.text) && !isExclusion(p.text));
  if (repCandidates.length > 0) {
    return repCandidates[repCandidates.length - 1].html;
  }

  // 2) Any Repentance line (take the last)
  const repAny = parts.map((p, i) => ({ ...p, i })).filter((p) => matchRepentance(p.text));
  if (repAny.length > 0) {
    return repAny[repAny.length - 1].html;
  }

  // 3) Afterbirth+ (last)
  const abp = parts.map((p, i) => ({ ...p, i })).filter((p) => matchABPlus(p.text));
  if (abp.length > 0) {
    return abp[abp.length - 1].html;
  }

  // 4) Afterbirth (last)
  const ab = parts.map((p, i) => ({ ...p, i })).filter((p) => matchAB(p.text));
  if (ab.length > 0) {
    return ab[ab.length - 1].html;
  }

  // 5) Fallback to last line
  return parts[parts.length - 1].html;
}

function sanitizeUnlockHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "b",
      "strong",
      "i",
      "em",
      "span",
      "ul",
      "ol",
      "li",
      "br",
      "code"
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      span: ["class"]
    },
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"]
    },
    transformTags: {
      a: (_tagName, attribs): sanitizeHtml.Tag => {
        const href = attribs.href ? toAbsoluteHref(attribs.href) : "";
        const newAttribs: sanitizeHtml.Attributes = {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer"
        };
        if (href) {
          newAttribs.href = href;
        } else {
          delete (newAttribs as Record<string, string>).href;
        }
        return { tagName: "a", attribs: newAttribs };
      }
    }
  });
}

export async function GET() {
  try {
    const res = await fetch(API_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "IsaacAchievementsTracker/1.0 (+https://vercel.com) contact:localdev"
      },
      cache: "no-store"
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed with ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as any;
    const html: string =
      data?.parse?.text?.["*"] ??
      data?.parse?.text ??
      data?.parse?.["*"] ??
      "";

    if (!html) {
      return NextResponse.json(
        { error: "Wiki parse API returned no HTML content." },
        { status: 502 }
      );
    }

    const $ = load(html);
    const achievementsMap = new Map<number, Achievement>();

    $("table").each((_, table) => {
      const idx = findColumnIndexes($, table);
      if (!idx) return;

      $(table)
        .find("tr")
        .each((rowIdx, tr) => {
          if (rowIdx === 0) return; // header
          const cells = $(tr).find("td");
          if (cells.length < 3) return;

          const idText = cells.eq(idx.id).text();
          const idStr = idText.replace(/[^\d]/g, "");
          const id = parseInt(idStr, 10);
          if (!Number.isFinite(id)) return;

          const nameCell = cells.eq(idx.name);
          const name = nameCell.text().trim();
          if (!name) return;

          const rawHref = nameCell.find("a").first().attr("href") || "";
          const url = rawHref ? toAbsoluteHref(rawHref) : undefined;

          let unlockHtmlRaw = cells.eq(idx.unlock).html() ?? "";
          if (!unlockHtmlRaw)
            unlockHtmlRaw = cells.eq(idx.unlock).text().trim();

          // Keep only the "latest" variant based on version wording
          const latestVariantRaw = pickLatestVersionSnippet(unlockHtmlRaw);

          // Normalize links then sanitize the chosen variant
          const frag = load(latestVariantRaw);
          frag("a").each((__, a) => {
            const $a = frag(a);
            const href = $a.attr("href") || "";
            $a.attr("href", toAbsoluteHref(href));
            $a.attr("target", "_blank");
            $a.attr("rel", "noopener noreferrer");
          });
          const transformed = frag.root().html() || "";
          const unlockHtml = sanitizeUnlockHtml(transformed);

          if (!achievementsMap.has(id)) {
            achievementsMap.set(id, { id, name, unlockHtml, url });
          }
        });
    });

    const achievements = Array.from(achievementsMap.values()).sort(
      (a, b) => a.id - b.id
    );

    if (achievements.length < 500) {
      return NextResponse.json(
        {
          error:
            "Parsed fewer than 500 achievements. The wiki layout may " +
            "have changed. Please try again later."
        },
        { status: 500 }
      );
    }

    const payload = {
      achievements,
      count: achievements.length,
      source: `${WIKI_BASE}/wiki/${PAGE}`,
      lastFetched: new Date().toISOString()
    };

    const response = NextResponse.json(payload, { status: 200 });
    response.headers.set(
      "Cache-Control",
      "s-maxage=86400, stale-while-revalidate=43200"
    );
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}