// Minimal Notion-as-CMS fetch for the Blog (ADR-0001 decision 3, Product - Welico.md Owner
// decision 18). Scope for this pass: list + detail fetch only.
//
// Deliberately NOT built here (still open, see ADR-0001 Follow-up "Notion 발행 계약"):
// - pagination beyond the first page of results
// - rate-limit handling / keeping the previous build's content on a failed fetch
// - a full block-to-HTML renderer (only paragraphs/headings/lists are handled; the
//   database has zero real posts yet, so there is nothing to validate a fuller renderer against)
const NOTION_VERSION = '2022-06-28';

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

/** Very small block renderer: paragraph, heading_1-3, bulleted/numbered list items.
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
    return blocks
      .map((block) => {
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
      .join('\n');
  } catch {
    return '';
  }
}
