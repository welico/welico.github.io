// Synced from the Notion "Products" database (fef6e2a6-f474-461c-b1dc-c1502d2bdf9b) instead
// of the previous manually curated list. Only Launched / MVP Ready / Building products are
// eligible for display in that DB, mirrored here via the Status select options.
import { notionHeaders, queryNotionDatabaseAll, type NotionPageResult } from '../lib/notion';

export interface Product {
  name: string;
  status: 'Launched' | 'MVP Ready' | 'Building';
  description: string;
  url: string | null;
}

export const STATUS_LABEL: Record<Product['status'], string> = {
  Launched: 'Launched',
  'MVP Ready': 'MVP Ready',
  Building: 'Building',
};

function mapProduct(page: NotionPageResult): Product {
  const props = page.properties;
  return {
    name: props.Name?.title?.[0]?.plain_text ?? 'Untitled',
    status: props.Status?.select?.name ?? 'Building',
    description: props.Description?.rich_text?.[0]?.plain_text ?? '',
    url: props.URL?.url ?? null,
  };
}

/** Products, ordered by the Order property ascending. Returns [] only when Notion isn't
 *  configured (no NOTION_TOKEN / NOTION_PRODUCTS_DATABASE_ID); a configured fetch that fails
 *  throws so the build fails instead of publishing an empty list (same principle as
 *  getPublishedPosts in lib/notion.ts). */
export async function getProducts(): Promise<Product[]> {
  const headers = notionHeaders();
  const databaseId = import.meta.env.NOTION_PRODUCTS_DATABASE_ID;
  if (!headers || !databaseId) return [];

  const results = await queryNotionDatabaseAll(databaseId, headers, {
    sorts: [{ property: 'Order', direction: 'ascending' }],
  });
  return results.map(mapProduct);
}
