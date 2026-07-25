// Manually curated from 10_Projects/Products/_Products Database (Obsidian Vault) — no
// automated sync yet (Product - Welico.md Owner decision 1, PRD Open Questions 5).
// Only Launched / MVP Ready / Building products are eligible for display.
export interface Product {
  name: string;
  status: 'Launched' | 'MVP Ready' | 'Building';
  description: string;
  url: string | null;
}

export const PRODUCTS: Product[] = [
  {
    name: 'Agent Speech Plugin',
    status: 'Launched',
    description: 'macOS native text-to-speech for Claude Code responses.',
    url: null,
  },
  {
    name: 'Obsidian Repository Navigator',
    status: 'Launched',
    description: 'Browse and link GitHub repositories inside your Obsidian vault.',
    url: null,
  },
  {
    name: 'Obsidian Split Translator',
    status: 'Launched',
    description: 'Side-by-side note translation inside Obsidian.',
    url: null,
  },
  {
    name: 'AIGauge',
    status: 'Building',
    description: 'Usage and cost tracking across AI providers.',
    url: null,
  },
];

export const STATUS_LABEL: Record<Product['status'], string> = {
  Launched: 'Launched',
  'MVP Ready': 'MVP Ready',
  Building: 'Building',
};
