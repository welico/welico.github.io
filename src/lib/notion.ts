// Minimal Notion-as-CMS fetch for the Blog (ADR-0001 decision 3, Product - Welico.md Owner
// decision 18). Scope for this pass: list + detail fetch only.
//
// A failed database query throws, which fails `astro build` — GitHub Actions then keeps
// the last successful deploy instead of publishing an empty list (silent data loss).
// Missing credentials (no NOTION_TOKEN / database id configured) is treated as "feature
// off" rather than a failure, so local builds without secrets still succeed with [].
//
// Deliberately NOT built here (still open, see ADR-0001 Follow-up "Notion 발행 계약"):
// - rate-limit handling
// - a full block-to-HTML renderer (only paragraphs/headings/lists/images are handled; the
//   database has zero real posts yet, so there is nothing to validate a fuller renderer against)
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const NOTION_VERSION = '2022-06-28';

// Notion's file.url for uploaded images is a presigned S3 link that expires ~1h after
// the API response — it can't be used directly as an <img src>. Download it at build
// time so the deployed page serves a stable local copy.
// Written straight into the build output dir (astro's default outDir), not public/:
// astro copies public/ -> dist/ before page rendering runs, so anything written to
// public/ during getStaticPaths/page render never makes it into the final output.
// process.cwd() (not import.meta.url) because astro build bundles this module into
// dist/, which breaks any path resolved relative to the module's own location.
const ASSETS_DIR = path.join(process.cwd(), 'dist', 'notion-assets');

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

// Notion block ids are UUIDs; reject anything else before it touches a file path
// (defense in depth against a manipulated/unexpected API response landing outside ASSETS_DIR).
const BLOCK_ID_RE = /^[a-zA-Z0-9-]+$/;

// Blocks fetch targets that would let a Notion editor point an "external image" URL at
// internal infrastructure (cloud metadata endpoints, localhost, private ranges) — the
// build runner would otherwise fetch it and publish the response as a public file.
// ponytail: literal-IP / known-hostname checks only, no DNS resolution — doesn't stop
// DNS rebinding. Add resolution-time checks if this ever accepts untrusted workspaces.
function assertSafeImageUrl(rawUrl: string): void {
  const u = new URL(rawUrl);
  if (u.protocol !== 'https:') throw new Error(`unsafe image url scheme: ${u.protocol}`);
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === 'metadata.google.internal') {
    throw new Error(`blocked internal host: ${host}`);
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0;
    if (isPrivate) throw new Error(`blocked private ip: ${host}`);
  }
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    throw new Error(`blocked private ipv6: ${host}`);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function downloadNotionImage(url: string, blockId: string): Promise<string> {
  if (!BLOCK_ID_RE.test(blockId)) throw new Error(`unexpected block id: ${blockId}`);
  assertSafeImageUrl(url);
  const urlExt = path.extname(new URL(url).pathname).replace('.', '');

  // Reuse whatever extension a previous build already resolved for this block, so
  // repeated local builds don't re-fetch an image that's already on disk.
  for (const ext of [urlExt, ...Object.values(EXT_BY_CONTENT_TYPE)]) {
    if (!ext) continue;
    const candidate = path.join(ASSETS_DIR, `${blockId}.${ext}`);
    try {
      await access(candidate);
      return `/notion-assets/${blockId}.${ext}`;
    } catch {
      // not cached yet, keep looking / fall through to fetch
    }
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  const contentType = res.headers.get('content-type') ?? '';
  const ext = urlExt || EXT_BY_CONTENT_TYPE[contentType] || 'jpg';
  const bytes = Buffer.from(await res.arrayBuffer());

  await mkdir(ASSETS_DIR, { recursive: true });
  await writeFile(path.join(ASSETS_DIR, `${blockId}.${ext}`), bytes);
  return `/notion-assets/${blockId}.${ext}`;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  tags: string[];
  publishedDate: string | null;
}

export interface NotionPageResult {
  id: string;
  properties: Record<string, any>;
}

export function notionHeaders() {
  const token = import.meta.env.NOTION_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

/** Queries a database, following has_more/next_cursor until every page is collected.
 *  Throws on a non-ok response instead of swallowing it — callers let this fail the build. */
export async function queryNotionDatabaseAll(
  databaseId: string,
  headers: Record<string, string>,
  body: Record<string, any> = {}
): Promise<NotionPageResult[]> {
  const results: NotionPageResult[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, start_cursor: cursor, page_size: 100 }),
    });
    if (!res.ok) {
      throw new Error(`Notion query failed for database ${databaseId}: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    results.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

function mapPost(page: NotionPageResult): BlogPost {
  const props = page.properties;
  return {
    id: page.id,
    title: props.Title?.title?.[0]?.plain_text ?? 'Untitled',
    slug: props.Slug?.rich_text?.[0]?.plain_text ?? page.id,
    tags: (props.Tags?.multi_select ?? []).map((t: { name: string }) => t.name),
    publishedDate: props['Published Date']?.date?.start ?? null,
  };
}

/** Published posts, newest first, across all pages of the database. Returns [] only when
 *  Notion isn't configured (no NOTION_TOKEN / NOTION_DATABASE_ID); a configured fetch that
 *  fails throws so the build fails instead of publishing an empty list. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const headers = notionHeaders();
  const databaseId = import.meta.env.NOTION_DATABASE_ID;
  if (!headers || !databaseId) return [];

  const results = await queryNotionDatabaseAll(databaseId, headers, {
    filter: { property: 'Status', select: { equals: 'Published' } },
    sorts: [{ property: 'Published Date', direction: 'descending' }],
  });
  return results.map(mapPost);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const posts = await getPublishedPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: any;
}

function richTextToPlain(richText: Array<{ plain_text: string }> = []): string {
  return richText.map((t) => t.plain_text).join('');
}

/** Very small block renderer: paragraph, heading_1-3, bulleted/numbered list items, images.
 *  Anything else is skipped — expand once real posts exercise more block types. */
export async function getPostBlocksHtml(pageId: string): Promise<string> {
  const headers = notionHeaders();
  if (!headers) return '';
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      headers,
    });
    if (!res.ok) return '';
    const data = await res.json();
    const blocks: NotionBlock[] = data.results ?? [];
    const rendered = await Promise.all(
      blocks.map(async (block) => {
        if (block.type === 'image') {
          const image = block.image ?? {};
          const sourceUrl = image.file?.url ?? image.external?.url;
          if (!sourceUrl) return '';
          try {
            const localSrc = await downloadNotionImage(sourceUrl, block.id);
            const alt = escapeHtml(richTextToPlain(image.caption));
            return `<img src="${escapeHtml(localSrc)}" alt="${alt}" loading="lazy" />`;
          } catch {
            return '';
          }
        }

        const text = escapeHtml(richTextToPlain(block[block.type]?.rich_text));
        switch (block.type) {
          case 'heading_1':
            return `<h2>${text}</h2>`;
          case 'heading_2':
            return `<h3>${text}</h3>`;
          case 'heading_3':
            return `<h4>${text}</h4>`;
          case 'bulleted_list_item':
          case 'numbered_list_item':
            return `<li>${text}</li>`;
          case 'paragraph':
            return `<p>${text}</p>`;
          default:
            return '';
        }
      })
    );
    return rendered.join('\n');
  } catch {
    return '';
  }
}
