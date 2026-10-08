import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE_URL = "https://aikomputeapi-web.github.io/convert";
const BASE_PATH = "/convert";
const SOURCE_DIR = path.resolve("src/content/blog");
const OUTPUT_DIR = path.resolve("dist/blog");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function scalar(value) {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replaceAll("\\\"", '"').replaceAll("''", "'");
  }
  return text;
}

function parseArticle(source, filename) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  const metadata = {};
  let currentList = "";
  let body = source;

  if (match) {
    body = match[2].trim();
    for (const line of match[1].split(/\r?\n/)) {
      const item = line.match(/^\s*-\s+(.+)$/);
      if (item && currentList) {
        metadata[currentList].push(scalar(item[1]));
        continue;
      }
      const field = line.match(/^([A-Za-z][\w-]*):(?:\s*(.*))?$/);
      if (!field) continue;
      const [, key, raw = ""] = field;
      if (raw.trim()) {
        metadata[key] = scalar(raw);
        currentList = "";
      } else {
        metadata[key] = [];
        currentList = key;
      }
    }
  }

  const title = String(metadata.title || body.match(/^#\s+(.+)$/m)?.[1] || path.basename(filename, ".md"));
  const slug = String(metadata.slug || path.basename(filename, ".md"))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const description = String(metadata.description || body.replace(/^#.*$/m, "").trim().split(/\n\s*\n/)[0] || title)
    .replace(/\s+/g, " ")
    .slice(0, 155);
  const pubDate = String(metadata.pubDate || "").slice(0, 10);

  return { title, slug, description, pubDate, body };
}

function inlineMarkdown(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, rawUrl) => {
    const url = rawUrl.replaceAll("&amp;", "&").trim();
    if (!/^(https?:\/\/|\/|#)/i.test(url)) return label;
    const external = /^https?:\/\//i.test(url);
    return `<a href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return safe;
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let listType = "";
  let listItems = [];

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    const tag = listType === "ol" ? "ol" : "ul";
    html.push(`<${tag}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${tag}>`);
    listItems = [];
    listType = "";
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const list = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length + 1, 4);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      html.push(`<blockquote><p>${inlineMarkdown(line.replace(/^\s*>\s?/, ""))}</p></blockquote>`);
    } else if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      flushParagraph();
      flushList();
      html.push("<hr>");
    } else if (list) {
      flushParagraph();
      const type = list[2] ? "ol" : "ul";
      if (listType && listType !== type) flushList();
      listType = type;
      listItems.push(list[3]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return html.join("\n");
}

const styles = `
  :root{color-scheme:dark;--bg:#0a0f1a;--panel:#111827;--line:#253144;--text:#e8eef7;--muted:#a7b3c5;--accent:#5eead4}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.wrap{width:min(980px,calc(100% - 40px));margin:0 auto}
  .top{border-bottom:1px solid var(--line);background:#0c1320}.top-inner{height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}
  .brand{font-weight:750;font-size:20px;color:var(--text);letter-spacing:.02em}.brand-mark{color:var(--accent);margin-right:9px}.top-links{display:flex;gap:22px;font-size:14px}
  .crumb{margin-top:34px;color:var(--muted);font-size:14px}.hero{padding:42px 0 28px}.eyebrow{color:var(--accent);font:12px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase}
  h1{font-size:clamp(34px,6vw,56px);line-height:1.08;letter-spacing:-.04em;margin:14px 0 16px}.intro{font-size:18px;color:var(--muted);max-width:760px}.meta{color:var(--muted);font-size:14px;margin-top:20px}
  .card{border:1px solid var(--line);border-radius:16px;background:linear-gradient(145deg,#111b2b,#0e1522);padding:24px;margin:18px 0}.card h2{font-size:23px;line-height:1.25;margin:0 0 8px}.card p{color:var(--muted);margin:8px 0}.content{max-width:760px;margin:12px auto 70px}.content h2{font-size:29px;line-height:1.25;letter-spacing:-.02em;margin:44px 0 12px}.content h3{font-size:21px;margin:30px 0 8px}.content p,.content li{color:#d3dbe8}.content ul,.content ol{padding-left:26px}.content li{margin:7px 0}.content blockquote{margin:24px 0;border-left:3px solid var(--accent);padding:4px 18px;color:var(--muted)}.content code{font: .9em ui-monospace,Consolas,monospace;background:#172235;padding:2px 5px;border-radius:4px}.content hr{border:0;border-top:1px solid var(--line);margin:34px 0}
  .cta{margin:54px 0 70px;padding:26px;border:1px solid #27635f;border-radius:16px;background:#102623}.button{display:inline-block;border-radius:9px;background:var(--accent);color:#071411;padding:11px 17px;font-weight:700;margin-top:8px}.footer{border-top:1px solid var(--line);padding:25px 0;color:var(--muted);font-size:13px}
  @media(max-width:600px){.top-inner{height:62px}.top-links{gap:12px}.top-links a:first-child{display:none}.hero{padding-top:32px}.card{padding:19px}.content h2{font-size:25px}}
`;

function pageShell({ title, description, canonical, body, structuredData = null, type = "website" }) {
  const jsonLd = structuredData
    ? `<script type="application/ld+json">${JSON.stringify(structuredData).replaceAll("</", "<\\/")}</script>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="${escapeHtml(type)}"><meta property="og:site_name" content="Kaleido">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">
<meta name="theme-color" content="#0a0f1a"><style>${styles}</style>${jsonLd}</head><body>
<header class="top"><div class="wrap top-inner"><a class="brand" href="${BASE_PATH}/"><span class="brand-mark">△</span>Kaleido</a><nav class="top-links"><a href="${BASE_PATH}/blog/">Guides</a><a href="${BASE_PATH}/#tool">Convert a file</a></nav></div></header>
<main class="wrap">${body}</main><footer class="footer"><div class="wrap">Kaleido Guides · Practical file conversion help. <a href="${BASE_PATH}/">Back to the converter</a></div></footer>
</body></html>`;
}

const files = await readdir(SOURCE_DIR).catch((error) => {
  if (error.code === "ENOENT") return [];
  throw error;
});
const articles = [];
for (const filename of files.filter((file) => file.toLowerCase().endsWith(".md"))) {
  const source = await readFile(path.join(SOURCE_DIR, filename), "utf8");
  const article = parseArticle(source, filename);
  if (article.slug) articles.push(article);
}
articles.sort((a, b) => b.pubDate.localeCompare(a.pubDate) || a.title.localeCompare(b.title));

await mkdir(OUTPUT_DIR, { recursive: true });
const cards = articles.length
  ? articles.map((article) => `<article class="card"><h2><a href="${BASE_PATH}/blog/${encodeURIComponent(article.slug)}/">${escapeHtml(article.title)}</a></h2><p>${escapeHtml(article.description)}</p><div class="meta">${escapeHtml(article.pubDate || "Kaleido guide")}</div></article>`).join("\n")
  : `<section class="card"><h2>Guides are on the way</h2><p>We’re preparing practical guides about file formats, conversion, and keeping your files on your device.</p></section>`;
const listBody = `<div class="crumb"><a href="${BASE_PATH}/">Kaleido</a> / Guides</div><section class="hero"><span class="eyebrow">THE KALEIDO FIELD GUIDE</span><h1>File conversion, explained.</h1><p class="intro">Straightforward help with formats, compatibility, and getting files ready for the tools you use.</p></section><section aria-label="Latest guides">${cards}</section><section class="cta"><h2>Ready to convert a file?</h2><p>Choose a file and an output format. Kaleido processes supported conversions on your device.</p><a class="button" href="${BASE_PATH}/#tool">Open the converter</a></section>`;
await writeFile(path.join(OUTPUT_DIR, "index.html"), pageShell({
  title: "File Conversion Guides | Kaleido",
  description: "Practical guides to file formats, conversion, and working with files in your browser.",
  canonical: `${SITE_URL}/blog/`,
  body: listBody,
}));

for (const article of articles) {
  const articleDir = path.join(OUTPUT_DIR, article.slug);
  await mkdir(articleDir, { recursive: true });
  const articleBody = article.body.replace(/^#\s+[^\r\n]+\s*(?:\r?\n)?/, "");
  const body = `<div class="crumb"><a href="${BASE_PATH}/">Kaleido</a> / <a href="${BASE_PATH}/blog/">Guides</a></div><article><header class="hero"><span class="eyebrow">KALEIDO FIELD GUIDE</span><h1>${escapeHtml(article.title)}</h1><p class="intro">${escapeHtml(article.description)}</p>${article.pubDate ? `<div class="meta"><time datetime="${escapeHtml(article.pubDate)}">${escapeHtml(article.pubDate)}</time></div>` : ""}</header><div class="content">${renderMarkdown(articleBody)}</div></article><section class="cta"><h2>Put the guide into practice</h2><p>Try a supported conversion with Kaleido. Your file stays on your device while it is processed.</p><a class="button" href="${BASE_PATH}/#tool">Open Kaleido</a></section>`;
  const canonical = `${SITE_URL}/blog/${encodeURIComponent(article.slug)}/`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.pubDate || undefined,
    author: { "@type": "Organization", name: "Kaleido" },
    publisher: { "@type": "Organization", name: "Kaleido" },
    mainEntityOfPage: canonical,
  };
  await writeFile(path.join(articleDir, "index.html"), pageShell({
    title: `${article.title} | Kaleido Guides`,
    description: article.description,
    canonical,
    body,
    structuredData,
    type: "article",
  }));
}

const sitemapEntries = [
  `<url><loc>${SITE_URL}/</loc></url>`,
  `<url><loc>${SITE_URL}/blog/</loc></url>`,
  ...articles.map((article) => `<url><loc>${SITE_URL}/blog/${encodeURIComponent(article.slug)}/</loc>${article.pubDate ? `<lastmod>${escapeHtml(article.pubDate)}</lastmod>` : ""}</url>`),
].join("");
await writeFile(path.resolve("dist/sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapEntries}</urlset>`);
await writeFile(path.resolve("dist/robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`Generated ${articles.length} Kaleido guide page(s), sitemap.xml, and robots.txt.`);
