import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Guide',
      collapsed: false,
      items: [
        'guide/introduction',
        'guide/installation',
        'guide/getting-started',
        'guide/configuration',
        'guide/cli',
        'guide/security',
      ],
    },
    {
      type: 'category',
      label: 'User Manual',
      collapsed: false,
      items: [
        'manual/tools',
        'manual/exec',
        'manual/runtimes',
        'manual/sessions',
        'manual/examples',
      ],
    },
    {
      type: 'category',
      label: 'Developer',
      items: [
        'developer/architecture',
        'developer/plugin-compatibility',
        'developer/observability',
        'developer/codex-sandboxing',
        'developer/gemini-sandboxing',
        'developer/cursor-sandboxing',
        'developer/agent-plugins',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/competitive-analysis',
        'reference/case-study',
        'reference/projects-featured-in',
        'reference/changelog',
      ],
    },
  ],
};

export default sidebars;
