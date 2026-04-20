import { prisma } from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import path from "node:path";
import OpenAI from "openai";

const MIN_EPUB_CHAPTER_CHARS = 100;

/** Matches a single line that is a PG-style chapter heading (used after newline-preserving strip). */
const PG_CHAPTER_HEADING_LINE = /^(CHAPTER|PART)\s+[IVXLCDM\d]+\.?\s*$/i;

const PG_EBOOK_START_MARKER = "*** START OF THE PROJECT GUTENBERG EBOOK";
const PG_EBOOK_END_MARKER = "*** END OF THE PROJECT GUTENBERG EBOOK";

/**
 * Remove standard Project Gutenberg wrapper lines from plain text (after HTML strip).
 * Drops everything before the START line (inclusive) and everything from the END line onward (inclusive).
 */
function stripGutenbergEbookMarkers(text: string): string {
  let s = text;
  const sl = s.toLowerCase();
  const startNeedle = PG_EBOOK_START_MARKER.toLowerCase();
  const si = sl.indexOf(startNeedle);
  if (si !== -1) {
    const fromMarker = s.slice(si);
    const nl = fromMarker.indexOf("\n");
    s = nl === -1 ? "" : fromMarker.slice(nl + 1).trimStart();
  }
  const sl2 = s.toLowerCase();
  const endNeedle = PG_EBOOK_END_MARKER.toLowerCase();
  const ei = sl2.indexOf(endNeedle);
  if (ei !== -1) {
    const lineStart = s.lastIndexOf("\n", ei);
    s = lineStart === -1 ? "" : s.slice(0, lineStart).trimEnd();
  }
  return s.trim();
}

/** Collapse internal whitespace to a single line (for stored chapter text). */
function normalizePlainChapterText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Like stripHtmlToPlainText but keeps line breaks so chapter headings can be matched per line.
 */
function stripHtmlToPlainTextPreserveLines(html: string): string {
  let s = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:p|div|h[1-6]|section|article|header|footer|li|tr)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * When a spine HTML file contains 2+ PG-style chapter headings, split into separate chapters.
 * Returns null if at most one heading line (caller uses single-chapter + nav title).
 */
function splitPlainTextByChapterHeadings(
  text: string,
): { title: string; content: string }[] | null {
  const lines = text.split(/\r?\n/);
  const headingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (PG_CHAPTER_HEADING_LINE.test(lines[i]!.trim())) {
      headingIndices.push(i);
    }
  }
  if (headingIndices.length <= 1) return null;

  const out: { title: string; content: string }[] = [];
  for (let k = 0; k < headingIndices.length; k++) {
    const startLine = headingIndices[k]!;
    const title = lines[startLine]!.trim();
    const endLine = k + 1 < headingIndices.length ? headingIndices[k + 1]! : lines.length;
    const body = lines.slice(startLine + 1, endLine).join("\n");
    out.push({ title, content: body });
  }

  const firstIdx = headingIndices[0]!;
  if (firstIdx > 0) {
    const preamble = lines.slice(0, firstIdx).join("\n").trim();
    if (preamble && out[0]) {
      out[0] = {
        title: out[0].title,
        content: `${preamble}\n\n${out[0].content}`.trim(),
      };
    }
  }

  return out;
}

/** Strip remaining markup and normalize whitespace. */
function stripHtmlToPlainText(html: string): string {
  const withoutTags = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
  return withoutTags.replace(/\s+/g, " ").trim();
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  removeNSPrefix: true,
});

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function posixDir(p: string): string {
  return path.posix.dirname(p.replace(/\\/g, "/"));
}

/** Path to content file relative to EPUB root (no fragment). */
function epubRootPath(opfDir: string, href: string): string {
  const pathOnly = href.split("#")[0] ?? href;
  const joined = path.posix.join(opfDir, pathOnly);
  return path.posix.normalize(joined).replace(/^\//, "");
}

type ChapterAnchor = {
  zipPath: string;
  fragment: string | null;
  title: string;
};

/** Resolve OPF-relative href (may include #fragment) to zip path + fragment id. */
function splitHrefToZipAndFragment(
  baseDir: string,
  href: string,
): { zipPath: string; fragment: string | null } {
  const hashIdx = href.indexOf("#");
  const pathPart = hashIdx === -1 ? href : href.slice(0, hashIdx);
  let fragment: string | null =
    hashIdx === -1 ? null : (href.slice(hashIdx + 1).split(/[?]/)[0] ?? null);
  if (fragment === "") fragment = null;
  const zipPath = epubRootPath(baseDir, pathPart);
  return { zipPath, fragment };
}

/**
 * Start offset of the element whose opening tag contains id="id" (or id='id').
 * Used to slice XHTML so a chapter starts at its heading, not at a preceding page marker.
 */
function findElementStartById(html: string, id: string): number {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const idRe = new RegExp(`\\bid\\s*=\\s*["']${escaped}["']`, "i");
  const idMatch = html.match(idRe);
  if (!idMatch || idMatch.index === undefined) return -1;
  const lt = html.lastIndexOf("<", idMatch.index);
  return lt === -1 ? -1 : lt;
}

/** Gutenberg-style chapter break: `<hr class="chap"/>` (attribute order may vary). */
function findAllHrChapPositions(html: string): number[] {
  const positions: number[] = [];
  const re = /<hr\b[^>]*\bclass\s*=\s*["'][^"']*\bchap\b[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index !== undefined) positions.push(m.index);
  }
  return positions;
}

/**
 * End of chapter i's HTML slice: prefer `<hr class="chap"/>` just before the next
 * chapter anchor so trailing paragraphs / epigraphs after the last body block are kept;
 * fall back to the next anchor's start if no such `<hr>` exists.
 */
function chapterEndBeforeNextAnchor(
  rawHtml: string,
  nextAnchorStart: number,
  hrChapPositions: number[],
): number {
  if (nextAnchorStart >= rawHtml.length) return rawHtml.length;
  if (nextAnchorStart <= 0) return nextAnchorStart;
  let best = -1;
  for (const hr of hrChapPositions) {
    if (hr < nextAnchorStart && hr > best) best = hr;
  }
  return best === -1 ? nextAnchorStart : best;
}

/**
 * Split one spine HTML file at NCX/nav toc anchors only (not page-list ids).
 * Segment i runs from the start of the element with anchor i to just before the next
 * chapter boundary (prefer `<hr class="chap"/>` before the next heading, else that heading).
 */
function splitHtmlByChapterAnchors(
  rawHtml: string,
  anchorsInTocOrder: ChapterAnchor[],
): { title: string; html: string }[] {
  if (anchorsInTocOrder.length === 0) return [];

  const hrChapPositions = findAllHrChapPositions(rawHtml);

  const enriched = anchorsInTocOrder.map((a) => ({
    title: a.title,
    fragment: a.fragment,
    pos:
      a.fragment == null || a.fragment === ""
        ? 0
        : findElementStartById(rawHtml, a.fragment),
  }));

  enriched.sort((x, y) => {
    const ax = x.pos === -1 ? Number.MAX_SAFE_INTEGER : x.pos;
    const ay = y.pos === -1 ? Number.MAX_SAFE_INTEGER : y.pos;
    return ax - ay;
  });

  const out: { title: string; html: string }[] = [];
  for (let i = 0; i < enriched.length; i++) {
    const a = enriched[i]!;
    const startPos = a.pos === -1 ? 0 : a.pos;
    let endPos: number;
    if (i + 1 < enriched.length) {
      const next = enriched[i + 1]!;
      const nextAnchorStart = next.pos === -1 ? rawHtml.length : next.pos;
      endPos = chapterEndBeforeNextAnchor(rawHtml, nextAnchorStart, hrChapPositions);
    } else {
      endPos = rawHtml.length;
    }
    if (startPos < endPos) {
      out.push({ title: a.title, html: rawHtml.slice(startPos, endPos) });
    }
  }
  return out;
}

/** First `<dc:title>` in OPF (plain text, trimmed). */
function getOpfTitle(opfXml: string): string {
  const m = opfXml.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i);
  if (!m?.[1]) return "";
  return m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function filterChapterAnchorsByTitle(anchors: ChapterAnchor[], opfBookTitle: string): ChapterAnchor[] {
  const bookLower = opfBookTitle.trim().toLowerCase();
  return anchors.filter((a) => {
    const t = a.title.trim();
    const lower = t.toLowerCase();
    if (lower.startsWith("the full project gutenberg")) return false;
    if (lower === "contents." || lower === "contents" || lower === "table of contents") return false;
    if (bookLower.length > 0 && lower === bookLower) return false;
    return true;
  });
}

/** Chapter toc entries from EPUB3 nav document (toc nav only — not page-list). */
function parseNavChapterAnchorsOrdered(navHtml: string, navFileDir: string): ChapterAnchor[] {
  const out: ChapterAnchor[] = [];
  const navMatch = navHtml.match(
    /<nav\b[^>]*(?:\bepub:type\s*=\s*["']toc["']|\btype\s*=\s*["']toc["']|\brole\s*=\s*["']doc-toc["'])[^>]*>([\s\S]*?)<\/nav>/i,
  );
  if (!navMatch?.[1]) return out;
  const block = navMatch[1];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const attr = m[1] ?? "";
    const inner = m[2] ?? "";
    const hm = attr.match(/\bhref\s*=\s*(["'])([^"']*)\1/i);
    if (!hm?.[2]) continue;
    const rawHref = hm[2].trim();
    if (!rawHref || rawHref.startsWith("#")) continue;
    const title = stripHtmlToPlainText(inner);
    if (!title) continue;
    const hashIdx = rawHref.indexOf("#");
    const pathPart = hashIdx === -1 ? rawHref : rawHref.slice(0, hashIdx);
    const fragment =
      hashIdx === -1 ? null : (rawHref.slice(hashIdx + 1).split(/[?]/)[0] || null);
    const frag = fragment && fragment.length > 0 ? fragment : null;
    if (!pathPart) continue;
    const zipPath = epubRootPath(navFileDir, pathPart);
    out.push({ zipPath, fragment: frag, title });
  }
  return out;
}

/** NCX navMap only (real chapters). pageList pageTargets are not walked. */
function walkNcxChapterAnchorsOrdered(
  navPoint: unknown,
  ncxDir: string,
  out: ChapterAnchor[],
): void {
  for (const np of asArray(navPoint)) {
    const o = np as Record<string, unknown>;
    const content = o.content as Record<string, unknown> | undefined;
    const src = content?.["@_src"] as string | undefined;
    const text = ncxNavLabelText(o.navLabel);
    if (src && text) {
      const { zipPath, fragment } = splitHrefToZipAndFragment(ncxDir, src);
      out.push({ zipPath, fragment, title: text });
    }
    if (o.navPoint) walkNcxChapterAnchorsOrdered(o.navPoint, ncxDir, out);
  }
}

async function readZipText(zip: JSZip, zipPath: string): Promise<string | null> {
  const norm = zipPath.replace(/\\/g, "/");
  let f = zip.file(norm);
  if (!f) {
    const lower = norm.toLowerCase();
    for (const name of Object.keys(zip.files)) {
      if (!zip.files[name]!.dir && name.replace(/\\/g, "/").toLowerCase() === lower) {
        f = zip.file(name);
        break;
      }
    }
  }
  if (!f) return null;
  try {
    return await f.async("string");
  } catch {
    return null;
  }
}

function parseContainerXml(xml: string): string | null {
  const m = xml.match(/full-path\s*=\s*["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? null;
}

type ManifestItem = {
  id: string;
  href: string;
  properties?: string;
  mediaType?: string;
};

function findPackageRoot(doc: Record<string, unknown>): Record<string, unknown> | undefined {
  const p = doc.package;
  if (p && typeof p === "object") return p as Record<string, unknown>;
  for (const k of Object.keys(doc)) {
    if (k === "package" || k.endsWith(":package")) {
      const v = doc[k];
      if (v && typeof v === "object") return v as Record<string, unknown>;
    }
  }
  return undefined;
}

function opfAttr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, "i");
  const m = attrs.match(re);
  return m?.[2]?.trim();
}

/**
 * Regex fallback when fast-xml-parser misses namespaced or unusual OPF layouts.
 */
function parseOpfManifestAndSpineRegex(opfXml: string): {
  manifestById: Map<string, ManifestItem>;
  spineIdrefs: string[];
  spineTocIdref: string | null;
} {
  const manifestById = new Map<string, ManifestItem>();
  const itemRe = /<item\b([^>]+)>/gi;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(opfXml)) !== null) {
    const attrs = im[1] ?? "";
    const id = opfAttr(attrs, "id");
    const href = opfAttr(attrs, "href");
    if (!id || !href) continue;
    manifestById.set(id, {
      id,
      href,
      properties: opfAttr(attrs, "properties"),
      mediaType: opfAttr(attrs, "media-type") ?? opfAttr(attrs, "mediaType"),
    });
  }

  const spineIdrefs: string[] = [];
  const itemrefRe = /<itemref\b([^>]+)\/?>/gi;
  while ((im = itemrefRe.exec(opfXml)) !== null) {
    const idref = opfAttr(im[1] ?? "", "idref");
    if (idref) spineIdrefs.push(idref);
  }

  const spineOpen = opfXml.match(/<spine\b([^>]*)>/i);
  const tocAttr = spineOpen ? opfAttr(spineOpen[1] ?? "", "toc") : undefined;

  return {
    manifestById,
    spineIdrefs,
    spineTocIdref: tocAttr ?? null,
  };
}

function parseOpfManifestAndSpine(opfXml: string): {
  manifestById: Map<string, ManifestItem>;
  spineIdrefs: string[];
  spineTocIdref: string | null;
} {
  const xml = opfXml.replace(/^\uFEFF/, "");
  let manifestById = new Map<string, ManifestItem>();
  let spineIdrefs: string[] = [];
  let spineTocIdref: string | null = null;

  try {
    const doc = xmlParser.parse(xml) as Record<string, unknown>;
    const pkg = findPackageRoot(doc);
    if (pkg) {
      const manifestEl = pkg.manifest as Record<string, unknown> | undefined;
      const items = asArray(manifestEl?.item as Record<string, unknown> | undefined);

      for (const it of items) {
        const row = it as Record<string, unknown>;
        const id = row["@_id"] as string | undefined;
        const href = row["@_href"] as string | undefined;
        if (!id || !href) continue;
        manifestById.set(id, {
          id,
          href,
          properties: row["@_properties"] as string | undefined,
          mediaType: (row["@_media-type"] ?? row["@_mediaType"]) as string | undefined,
        });
      }

      const spineEl = pkg.spine as Record<string, unknown> | undefined;
      spineTocIdref = (spineEl?.["@_toc"] as string | undefined) ?? null;
      const itemrefs = asArray(spineEl?.itemref as Record<string, unknown> | undefined);
      for (const ir of itemrefs) {
        const row = ir as Record<string, unknown>;
        const idref = row["@_idref"] as string | undefined;
        if (idref) spineIdrefs.push(idref);
      }
    }
  } catch {
    // fall through to regex
  }

  if (manifestById.size === 0 || spineIdrefs.length === 0) {
    const rx = parseOpfManifestAndSpineRegex(xml);
    if (manifestById.size === 0) manifestById = rx.manifestById;
    if (spineIdrefs.length === 0) spineIdrefs = rx.spineIdrefs;
    if (!spineTocIdref && rx.spineTocIdref) spineTocIdref = rx.spineTocIdref;
  }

  if (manifestById.size === 0) {
    throw new Error("Invalid OPF: no manifest items found");
  }
  if (spineIdrefs.length === 0) {
    throw new Error("Invalid OPF: spine is empty");
  }

  return {
    manifestById,
    spineIdrefs,
    spineTocIdref,
  };
}

function parseNavTocAnchors(navHtml: string, navFileDir: string): Map<string, string> {
  const map = new Map<string, string>();
  const navMatch = navHtml.match(
    /<nav\b[^>]*(?:\bepub:type\s*=\s*["']toc["']|\btype\s*=\s*["']toc["']|\brole\s*=\s*["']doc-toc["'])[^>]*>([\s\S]*?)<\/nav>/i,
  );
  if (!navMatch?.[1]) return map;
  const block = navMatch[1];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const attr = m[1] ?? "";
    const inner = m[2] ?? "";
    const hm = attr.match(/\bhref\s*=\s*(["'])([^"']*)\1/i);
    if (!hm?.[2]) continue;
    const rawHref = hm[2].trim();
    if (!rawHref || rawHref.startsWith("#")) continue;
    const title = stripHtmlToPlainText(inner);
    if (!title) continue;
    const full = epubRootPath(navFileDir, rawHref);
    const key = full.toLowerCase();
    if (!map.has(key)) map.set(key, title);
  }
  return map;
}

function ncxNavLabelText(navLabel: unknown): string {
  if (navLabel == null) return "";
  if (typeof navLabel === "string") return stripHtmlToPlainText(navLabel);
  const o = navLabel as Record<string, unknown>;
  const textEl = o.text;
  if (textEl != null) {
    if (typeof textEl === "string") return stripHtmlToPlainText(textEl);
    if (Array.isArray(textEl)) {
      const first = textEl[0];
      if (typeof first === "string") return stripHtmlToPlainText(first);
      if (first && typeof first === "object") {
        const tt = (first as Record<string, unknown>)["#text"];
        if (typeof tt === "string") return stripHtmlToPlainText(tt);
      }
    }
    if (typeof textEl === "object") {
      const te = textEl as Record<string, unknown>;
      const inner = te["#text"] ?? te.text;
      if (typeof inner === "string") return stripHtmlToPlainText(inner);
    }
  }
  const t = o["#text"];
  if (typeof t === "string") return stripHtmlToPlainText(t);
  return "";
}

function walkNcxNavPoints(
  navPoint: unknown,
  ncxDir: string,
  map: Map<string, string>,
): void {
  for (const np of asArray(navPoint)) {
    const o = np as Record<string, unknown>;
    const content = o.content as Record<string, unknown> | undefined;
    const src = content?.["@_src"] as string | undefined;
    const text = ncxNavLabelText(o.navLabel);
    if (src && text) {
      const full = epubRootPath(ncxDir, src);
      const key = full.toLowerCase();
      if (!map.has(key)) map.set(key, text);
    }
    if (o.navPoint) walkNcxNavPoints(o.navPoint, ncxDir, map);
  }
}

function lookupTitle(
  titleByHref: Map<string, string>,
  opfDir: string,
  manifestHref: string,
): string | undefined {
  const full = epubRootPath(opfDir, manifestHref);
  const key = full.toLowerCase();
  if (titleByHref.has(key)) return titleByHref.get(key);
  const base = path.posix.basename(full).toLowerCase();
  for (const [k, v] of titleByHref) {
    if (path.posix.basename(k).toLowerCase() === base) return v;
  }
  return undefined;
}

const XHTML_LIKE =
  /^(?:application\/xhtml\+xml|application\/html\+xml|text\/html|text\/x-html)/i;

function isHtmlManifestItem(m: ManifestItem): boolean {
  const mt = (m.mediaType ?? "").toLowerCase();
  if (XHTML_LIKE.test(mt)) return true;
  if (mt.includes("xml") && mt.includes("html")) return true;
  const h = m.href.toLowerCase();
  return h.endsWith(".xhtml") || h.endsWith(".html") || h.endsWith(".htm");
}

/**
 * Parse an EPUB buffer: spine order, HTML stripped to plain text, short sections dropped.
 */
export async function parseEpub(
  buffer: Buffer,
): Promise<{ chapters: { title: string; content: string }[] }> {
  const zip = await JSZip.loadAsync(buffer);

  const containerXml = await readZipText(zip, "META-INF/container.xml");
  if (!containerXml) {
    throw new Error("Invalid EPUB: missing META-INF/container.xml");
  }

  const opfPath = parseContainerXml(containerXml);
  if (!opfPath) {
    throw new Error("Invalid EPUB: could not find OPF path in container.xml");
  }

  const opfXml = await readZipText(zip, opfPath);
  if (!opfXml) {
    throw new Error(`Invalid EPUB: could not read OPF at ${opfPath}`);
  }

  const opfDir = posixDir(opfPath);
  const { manifestById, spineIdrefs, spineTocIdref } = parseOpfManifestAndSpine(opfXml);
  const opfBookTitle = getOpfTitle(opfXml);

  const titleByHref = new Map<string, string>();
  const chapterAnchorsOrdered: ChapterAnchor[] = [];

  let navHref: string | undefined;
  for (const m of manifestById.values()) {
    const props = (m.properties ?? "").toLowerCase();
    if (/\bnav\b/.test(props)) {
      navHref = m.href;
      break;
    }
  }

  if (navHref) {
    const navPath = epubRootPath(opfDir, navHref);
    const navDir = posixDir(navPath);
    const navHtml = await readZipText(zip, navPath);
    if (navHtml) {
      const navMap = parseNavTocAnchors(navHtml, navDir);
      for (const [k, v] of navMap) titleByHref.set(k, v);
      chapterAnchorsOrdered.push(
        ...filterChapterAnchorsByTitle(
          parseNavChapterAnchorsOrdered(navHtml, navDir),
          opfBookTitle,
        ),
      );
    }
  }

  let ncxHref: string | undefined;
  if (spineTocIdref) {
    const tocItem = manifestById.get(spineTocIdref);
    if (tocItem?.href) ncxHref = tocItem.href;
  }
  if (!ncxHref) {
    for (const m of manifestById.values()) {
      const mt = (m.mediaType ?? "").toLowerCase();
      if (mt === "application/x-dtbncx+xml") {
        ncxHref = m.href;
        break;
      }
    }
  }

  if (ncxHref) {
    const ncxPath = epubRootPath(opfDir, ncxHref);
    const ncxDir = posixDir(ncxPath);
    const ncxXml = await readZipText(zip, ncxPath);
    if (ncxXml) {
      const ncxDoc = xmlParser.parse(ncxXml) as Record<string, unknown>;
      const ncxRoot = (ncxDoc.ncx as Record<string, unknown> | undefined) ?? ncxDoc;
      const navMap = ncxRoot.navMap as Record<string, unknown> | undefined;
      const points = navMap?.navPoint;
      walkNcxNavPoints(points, ncxDir, titleByHref);
      if (chapterAnchorsOrdered.length === 0) {
        walkNcxChapterAnchorsOrdered(points, ncxDir, chapterAnchorsOrdered);
        const filtered = filterChapterAnchorsByTitle(chapterAnchorsOrdered, opfBookTitle);
        chapterAnchorsOrdered.length = 0;
        chapterAnchorsOrdered.push(...filtered);
      }
    }
  }

  const chapters: { title: string; content: string }[] = [];
  let ordinal = 0;
  const processedTocSplitPaths = new Set<string>();

  for (const idref of spineIdrefs) {
    const m = manifestById.get(idref);
    if (!m || !isHtmlManifestItem(m)) continue;
    if (/\bnav\b/i.test(m.properties ?? "")) continue;

    const contentPath = epubRootPath(opfDir, m.href);
    const raw = await readZipText(zip, contentPath);
    if (!raw) continue;

    const pathKey = contentPath.toLowerCase();
    if (!processedTocSplitPaths.has(pathKey)) {
      const tocAnchors = chapterAnchorsOrdered.filter(
        (a) => a.zipPath.toLowerCase() === pathKey,
      );
      if (tocAnchors.length > 0) {
        const htmlParts = splitHtmlByChapterAnchors(raw, tocAnchors);
        if (htmlParts.length > 0) {
          processedTocSplitPaths.add(pathKey);
          for (const part of htmlParts) {
            let textWithLines = stripHtmlToPlainTextPreserveLines(part.html);
            textWithLines = stripGutenbergEbookMarkers(textWithLines);
            const content = normalizePlainChapterText(textWithLines);
            if (content.length < MIN_EPUB_CHAPTER_CHARS) continue;
            ordinal += 1;
            chapters.push({ title: part.title.trim() || `Chapter ${ordinal}`, content });
          }
          continue;
        }
      }
    }

    let textWithLines = stripHtmlToPlainTextPreserveLines(raw);
    textWithLines = stripGutenbergEbookMarkers(textWithLines);
    const splitParts = splitPlainTextByChapterHeadings(textWithLines);

    if (splitParts && splitParts.length > 0) {
      for (const part of splitParts) {
        const content = normalizePlainChapterText(part.content);
        if (content.length < MIN_EPUB_CHAPTER_CHARS) continue;
        ordinal += 1;
        chapters.push({ title: part.title, content });
      }
      continue;
    }

    const text = normalizePlainChapterText(textWithLines);
    if (text.length < MIN_EPUB_CHAPTER_CHARS) continue;

    ordinal += 1;
    let title = lookupTitle(titleByHref, opfDir, m.href)?.trim();
    if (!title) {
      title = `Chapter ${ordinal}`;
    }

    chapters.push({ title, content: text });
  }

  return { chapters };
}

export function detectFileType(_buffer: Buffer, filename: string): "epub" | "txt" {
  if (filename.toLowerCase().endsWith(".epub")) return "epub";
  return "txt";
}

export async function processBook(
  buffer: Buffer,
  filename: string,
): Promise<{ title: string; content: string }[]> {
  const type = detectFileType(buffer, filename);
  if (type === "epub") {
    const { chapters } = await parseEpub(buffer);
    return chapters;
  }
  return detectChapters(buffer.toString("utf-8"));
}

const CHAPTER_HEADER =
  /^[\s\uFEFF]*((?:CHAPTER|PART|BOOK|VOLUME)\s+[^\n\r]+)$/gim;

function splitByWordCount(text: string, wordsPerChunk: number): { title: string; content: string }[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [{ title: "Full text", content: text.trim() || "" }];
  }

  const out: { title: string; content: string }[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const slice = words.slice(i, i + wordsPerChunk).join(" ");
    out.push({ title: `Part ${out.length + 1}`, content: slice });
  }
  return out;
}

/**
 * Detect chapters via common Project Gutenberg–style headings, or fall back to ~5000-word slices.
 */
export function detectChapters(text: string): { title: string; content: string }[] {
  const normalized = text.replace(/\r\n/g, "\n");

  const indices: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CHAPTER_HEADER.source, CHAPTER_HEADER.flags);
  while ((m = re.exec(normalized)) !== null) {
    indices.push(m.index);
  }

  if (indices.length < 2) {
    return splitByWordCount(normalized, 5000);
  }

  const chapters: { title: string; content: string }[] = [];

  const preamble = normalized.slice(0, indices[0]).trim();
  if (preamble) {
    chapters.push({ title: "Front matter", content: preamble });
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1]! : normalized.length;
    const block = normalized.slice(start, end);
    const nl = block.indexOf("\n");
    const title = (nl === -1 ? block : block.slice(0, nl)).trim();
    const content = (nl === -1 ? "" : block.slice(nl + 1)).trim();
    if (title || content) {
      chapters.push({ title: title || `Chapter ${chapters.length + 1}`, content });
    }
  }

  return chapters.length > 0 ? chapters : splitByWordCount(normalized, 5000);
}

/** ~chunkSize tokens per chunk, overlap tokens between consecutive chunks (1 token ≈ 4 chars). */
export function chunkText(content: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const charPerToken = 4;
  const chunkLen = Math.max(1, chunkSize * charPerToken);
  let overlapLen = overlap * charPerToken;
  if (overlapLen >= chunkLen) {
    overlapLen = Math.max(0, chunkLen - 1);
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + chunkLen, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end >= trimmed.length) break;
    start = Math.max(0, end - overlapLen);
  }
  return chunks;
}

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

const EMBED_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

/** Batch embeddings (1536-dim for text-embedding-3-small). */
export async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) return [];

  const openai = getOpenAI();
  const out: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch,
    });

    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const row of sorted) {
      out.push(row.embedding);
    }
  }

  return out;
}

const RENUMBER_OFFSET = 1_000_000;

/**
 * Reassign sequenceNumber to 1…n in creation order (matches ingest order when createdAt aligns).
 */
export async function renumberChapters(bookId: string): Promise<void> {
  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { createdAt: "asc" },
  });
  if (chapters.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < chapters.length; i++) {
      await tx.chapter.update({
        where: { id: chapters[i]!.id },
        data: { sequenceNumber: RENUMBER_OFFSET + i },
      });
    }
    for (let i = 0; i < chapters.length; i++) {
      await tx.chapter.update({
        where: { id: chapters[i]!.id },
        data: { sequenceNumber: i + 1 },
      });
    }
  });
}

/** Keep denormalised currentChapterNumber in sync with chapter.sequenceNumber. */
export async function syncReadingProgressChapterNumbers(
  bookId: string,
): Promise<void> {
  const progresses = await prisma.readingProgress.findMany({
    where: { bookId },
  });
  for (const p of progresses) {
    const ch = await prisma.chapter.findUnique({
      where: { id: p.currentChapterId },
    });
    if (ch && ch.sequenceNumber !== p.currentChapterNumber) {
      await prisma.readingProgress.update({
        where: { id: p.id },
        data: { currentChapterNumber: ch.sequenceNumber },
      });
    }
  }
}
