// Minimal Notion-as-CMS fetch for the Blog (ADR-0001 decision 3, Product - Welico.md Owner
// decision 18). Scope for this pass: list + detail fetch only.
//
// Deliberately NOT built here (still open, see ADR-0001 Follow-up "Notion 발행 계약"):
// - pagination beyond the first page of results
// - rate-limit handling / keeping the previous build's content on a failed fetch
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

async function downloadNotionImage(url: string, blockId: string): Promise<string> {
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

interface NotionPageResult {
  id: string;
  properties: Record<string, any>;
}

function notionHeaders() {
  const token = import.meta.env.NOTION_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
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

/** Published posts, newest first. Returns [] on any error (missing creds, network, empty DB)
 *  rather than failing the build — see the "not built here" note above for what's deferred. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const headers = notionHeaders();
  const databaseId = import.meta.env.NOTION_DATABASE_ID;
  if (!headers || !databaseId) return [];

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: { property: 'Status', select: { equals: 'Published' } },
        sorts: [{ property: 'Published Date', direction: 'descending' }],
        page_size: 100,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map(mapPost);
  } catch {
    return [];
  }
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
            const alt = richTextToPlain(image.caption);
            return `<img src="${localSrc}" alt="${alt}" loading="lazy" />`;
          } catch {
            return '';
          }
        }

        const text = richTextToPlain(block[block.type]?.rich_text);
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
