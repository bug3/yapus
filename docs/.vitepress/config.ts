import { readdirSync } from 'node:fs';

interface LinkEntry {
  readonly text: string;
  readonly link: string;
}

const STANDARDS_DIR = new URL('../../standards/', import.meta.url);

// The README sections with a page each, in nav and sidebar order.
const SECTIONS: readonly LinkEntry[] = [
  { text: 'Quick Start', link: '/quick-start' },
  { text: 'delegator', link: '/delegator' },
  { text: 'ordo', link: '/ordo' },
];

// One sidebar entry per file in standards/, so a new standard needs only its
// include page.
const STANDARDS: readonly LinkEntry[] = readdirSync(STANDARDS_DIR)
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => name.slice(0, -'.md'.length))
  .map((name) => ({ text: name, link: `/standards/${ name }` }));

// VitePress reads the default export; the named one is the module's own name.
export const config = {
  title: 'yapus',
  description: 'Standards and orchestration for coding with an AI agent.',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [...SECTIONS, { text: 'Standards', link: '/standards/PRINCIPLES' }],
    sidebar: [...SECTIONS, { text: 'Standards', items: STANDARDS }],
    // A README section is one `##` heading over `###` subsections.
    outline: [2, 3],
    socialLinks: [{ icon: 'github', link: 'https://github.com/bug3/yapus' }],
    search: { provider: 'local' },
  },
} as const;

export default config;
