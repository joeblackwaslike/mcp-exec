import { defineConfig } from 'vitepress';
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs';

export default defineConfig({
  title: 'mcp-exec',
  description:
    'Reduce Claude token usage by 80–99% — intermediate data never enters the context window.',
  base: '/mcp-exec/',
  lang: 'en-US',

  head: [
    ['link', { rel: 'icon', href: '/mcp-exec/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3fb950' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'mcp-exec — 99% token reduction for AI agents' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'MCP server + Claude Code plugin. Keep intermediate data out of context. 43,800 → 90 tokens.',
      },
    ],
    [
      'meta',
      { property: 'og:image', content: 'https://joeblackwaslike.github.io/mcp-exec/og-image.png' },
    ],
    ['meta', { property: 'og:url', content: 'https://joeblackwaslike.github.io/mcp-exec/' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    [
      'meta',
      { name: 'twitter:image', content: 'https://joeblackwaslike.github.io/mcp-exec/og-image.png' },
    ],
  ],

  sitemap: {
    hostname: 'https://joeblackwaslike.github.io/mcp-exec/',
  },

  lastUpdated: true,

  markdown: {
    config(md) {
      md.use(tabsMarkdownPlugin);
    },
  },

  themeConfig: {
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },
    siteTitle: 'mcp-exec',

    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'User Manual', link: '/manual/tools', activeMatch: '/manual/' },
      { text: 'Developer', link: '/developer/architecture', activeMatch: '/developer/' },
      { text: 'Competitive Analysis', link: '/competitive-analysis' },
      {
        text: 'v1.0.0',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Releases', link: 'https://github.com/joeblackwaslike/mcp-exec/releases' },
          { text: 'npm', link: 'https://www.npmjs.com/package/@joeblackwaslike2/mcp-exec' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'CLI Reference', link: '/guide/cli' },
          { text: 'Security', link: '/guide/security' },
        ],
      },
      {
        text: 'User Manual',
        items: [
          { text: 'tools()', link: '/manual/tools' },
          { text: 'exec()', link: '/manual/exec' },
          { text: 'Runtimes', link: '/manual/runtimes' },
          { text: 'Sessions', link: '/manual/sessions' },
          { text: 'Examples', link: '/manual/examples' },
        ],
      },
      {
        text: 'Developer',
        items: [
          { text: 'Architecture', link: '/developer/architecture' },
          { text: 'Plugin Compatibility', link: '/developer/plugin-compatibility' },
          { text: 'Observability', link: '/developer/observability' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Case Study', link: '/case-study' },
          { text: 'Competitive Analysis', link: '/competitive-analysis' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/joeblackwaslike/mcp-exec' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Joe Black',
    },

    editLink: {
      pattern: 'https://github.com/joeblackwaslike/mcp-exec/edit/main/site/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },
  },
});
