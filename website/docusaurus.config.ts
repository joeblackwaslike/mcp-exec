import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'mcp-exec',
  tagline: '52,000 tokens → 50 tokens. Intermediate data never enters the context window.',
  favicon: 'img/favicon.ico',

  url: 'https://joeblackwaslike.github.io',
  baseUrl: '/mcp-exec/',
  trailingSlash: true,

  organizationName: 'joeblackwaslike',
  projectName: 'mcp-exec',
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/joeblackwaslike/mcp-exec/edit/main/website/',
        },
        blog: false,
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    metadata: [
      { name: 'og:title', content: 'mcp-exec — 52,000 tokens → 50 tokens' },
      {
        name: 'og:image',
        content: 'https://joeblackwaslike.github.io/mcp-exec/img/social-card.png',
      },
      { name: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@joeblackwaslike' },
    ],
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'mcp-exec',
      logo: {
        alt: 'mcp-exec logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          to: '/docs/guide/introduction',
          label: 'Guide',
          position: 'left',
        },
        {
          to: '/docs/manual/tools',
          label: 'Manual',
          position: 'left',
        },
        {
          to: '/docs/developer/architecture',
          label: 'Developer',
          position: 'left',
        },
        {
          to: '/docs/reference/competitive-analysis',
          label: 'Reference',
          position: 'left',
        },
        {
          type: 'dropdown',
          label: 'v1.0.0',
          position: 'right',
          items: [
            {
              label: 'Changelog',
              to: '/docs/reference/changelog',
            },
            {
              label: 'GitHub Releases',
              href: 'https://github.com/joeblackwaslike/mcp-exec/releases',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@joeblackwaslike2/mcp-exec',
            },
          ],
        },
        {
          href: 'https://github.com/joeblackwaslike/mcp-exec',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    algolia: undefined,
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: false,
      },
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/docs/guide/introduction' },
            { label: 'Installation', to: '/docs/guide/installation' },
            { label: 'Getting Started', to: '/docs/guide/getting-started' },
            { label: 'User Manual', to: '/docs/manual/tools' },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/joeblackwaslike/mcp-exec',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@joeblackwaslike2/mcp-exec',
            },
            {
              label: 'Issues',
              href: 'https://github.com/joeblackwaslike/mcp-exec/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © 2025 Joe Black. Licensed under MIT. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'python', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
