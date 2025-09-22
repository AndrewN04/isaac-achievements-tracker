import { NextResponse } from "next/server";
import { load, type CheerioAPI, type Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import sanitizeHtml from "sanitize-html";

export const runtime = "nodejs";

type Achievement = {
  id: number;
  name: string;
  unlockHtml: string;
  url?: string;
  imageUrl?: string;
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

function toAbsoluteSrc(src: string): string {
  const s = (src || "").trim();
  if (!s) return s;
  if (s.startsWith("/")) return `${WIKI_BASE}${s}`;
  if (/^(https?:)/i.test(s)) return s;
  return `${WIKI_BASE}/${s.replace(/^\/+/, "")}`;
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
  $table: Cheerio<AnyNode>
): { id: number; name: number; unlock: number; image?: number } | null {
  const headers: string[] = [];
  $table
    .find("tr")
    .first()
    .find("th, td")
    .each((_, el) => {
      headers.push(normalizeHeader($(el).text()));
    });

  let idIdx = -1;
  let nameIdx = -1;
  let unlockIdx = -1;
  let imageIdx: number | undefined;

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
    if (
      imageIdx === undefined &&
      (h.includes("image") || h.includes("icon") || h.includes("sprite"))
    ) {
      imageIdx = idx;
    }
  });

  if (idIdx === -1 || nameIdx === -1 || unlockIdx === -1) return null;
  return { id: idIdx, name: nameIdx, unlock: unlockIdx, image: imageIdx };
}

function sanitizeUnlockHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "img",
      "b",
      "strong",
      "i",
      "em",
      "span",
      "small",
      "sup",
      "sub",
      "ul",
      "ol",
      "li",
      "br",
      "code"
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      span: ["class"],
      sup: ["class"],
      sub: ["class"],
      small: ["class"]
    },
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["http", "https"]
    },
    transformTags: {
      a: (_tagName, attribs): sanitizeHtml.Tag => {
        const href = attribs.href ? toAbsoluteHref(attribs.href) : "";
        const newAttribs: sanitizeHtml.Attributes = {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer"
        };
        if (href) newAttribs.href = href;
        else delete (newAttribs as Record<string, string>).href;
        return { tagName: "a", attribs: newAttribs };
      },
      img: (_tagName, attribs): sanitizeHtml.Tag => {
        const src = attribs.src ? toAbsoluteSrc(attribs.src) : "";
        const newAttribs: sanitizeHtml.Attributes = {
          ...attribs,
          loading: "lazy",
          decoding: "async"
        };
        if (src) newAttribs.src = src;
        else delete (newAttribs as Record<string, string>).src;
        return { tagName: "img", attribs: newAttribs };
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

    type ParseResponse = {
      parse?: { text?: { "*": string } | string };
    };
    const data: ParseResponse = await res.json();
    const html: string =
      (typeof data?.parse?.text === "string"
        ? data.parse.text
        : data?.parse?.text?.["*"]) ?? "";

    if (!html) {
      return NextResponse.json(
        { error: "Wiki parse API returned no HTML content." },
        { status: 502 }
      );
    }

    const $ = load(html);
    const achievementsMap = new Map<number, Achievement>();

    $("table").each((_, el) => {
      const $table = $(el);
      const idx = findColumnIndexes($, $table);
      if (!idx) return;

      $table
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

          // Capture achievement wiki link if present
          const rawHref = nameCell.find("a").first().attr("href") || "";
          const url = rawHref ? toAbsoluteHref(rawHref) : undefined;

          // Attempt to capture the image/icon
          let imageUrl: string | undefined;
          if (idx.image !== undefined) {
            const src =
              cells.eq(idx.image).find("img").first().attr("src") || "";
            if (src) imageUrl = toAbsoluteSrc(src);
          }
          if (!imageUrl) {
            const fallbackSrc = nameCell.find("img").first().attr("src") || "";
            if (fallbackSrc) imageUrl = toAbsoluteSrc(fallbackSrc);
          }
          if (!imageUrl && cells.length > 0) {
            const altSrc = cells.eq(0).find("img").first().attr("src") || "";
            if (altSrc) imageUrl = toAbsoluteSrc(altSrc);
          }

          // Keep the full unlock HTML (all versions/lines)
          let unlockHtmlRaw = cells.eq(idx.unlock).html() ?? "";
          if (!unlockHtmlRaw)
            unlockHtmlRaw = cells.eq(idx.unlock).text().trim();

          // Normalize links and image sources, then sanitize
          const frag = load(unlockHtmlRaw);
          frag("a").each((__, a) => {
            const $a = frag(a);
            const href = $a.attr("href") || "";
            $a.attr("href", toAbsoluteHref(href));
            $a.attr("target", "_blank");
            $a.attr("rel", "noopener noreferrer");
          });
          frag("img").each((__, img) => {
            const $img = frag(img);
            const src = $img.attr("src") || "";
            $img.attr("src", toAbsoluteSrc(src));
            $img.attr("loading", "lazy");
            $img.attr("decoding", "async");
          });
          const transformed = frag.root().html() || "";
          const unlockHtml = sanitizeUnlockHtml(transformed);

          if (!achievementsMap.has(id)) {
            achievementsMap.set(id, {
              id,
              name,
              unlockHtml,
              url,
              imageUrl
            });
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
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}