import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

// ── Data ──────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'tools(query)',
    icon: '🔍',
    description:
      'Search every connected MCP server without loading full schemas. Returns trimmed summaries — ~100 tokens instead of 40,000.',
    link: '/docs/manual/tools',
  },
  {
    title: 'exec(code, runtime)',
    icon: '⚡',
    description:
      'Run code in an OS-level sandbox. Only the final return value comes back to Claude. Intermediate API responses, pagination loops, and transformations stay out of context entirely.',
    link: '/docs/manual/exec',
  },
  {
    title: 'Three runtimes',
    icon: '🛠',
    description:
      'Node.js (stateful via globalThis, MCP imports), Bash (composable pipelines), Python (stateless, uv run --isolated, PEP 723 inline deps — pandas, httpx, anything on PyPI).',
    link: '/docs/manual/runtimes',
  },
];

const AGENTS = [
  'Claude Code',
  'Codex CLI',
  'Gemini CLI',
  'Cursor',
  'Windsurf',
  'OpenCode',
  'Cline',
];

// ── Components ────────────────────────────────────────────────────

function Hero() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className={styles.heroTitle}>
          52,000 tokens{' '}
          <span className={styles.heroArrow}>→</span>{' '}
          <span className={styles.heroAfter}>50 tokens.</span>
        </Heading>
        <p className={styles.heroSubtitle}>
          Intermediate data never enters the context window.
          <br />
          Route MCP tool workflows through an OS-level sandbox — only the final
          result comes back to Claude.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/guide/installation">
            Install Now
          </Link>
          <Link
            className={clsx('button button--outline button--lg', styles.btnOutline)}
            to="/docs/guide/introduction">
            How It Works
          </Link>
        </div>
      </div>
    </header>
  );
}

function FeatureCard({title, icon, description, link}: Readonly<(typeof FEATURES)[0]>) {
  return (
    <div className={clsx('col col--4', styles.featureCol)}>
      <Link to={link} className={styles.featureCardLink}>
        <div className="feature-card">
          <div className={styles.featureIcon}>{icon}</div>
          <Heading as="h3" className={styles.featureTitle}>
            <code>{title}</code>
          </Heading>
          <p className={styles.featureDesc}>{description}</p>
        </div>
      </Link>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" className={styles.sectionHeading}>
          Two tools. Massive savings.
        </Heading>
        <div className="row">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TokenComparison() {
  return (
    <section className={styles.tokenSection}>
      <div className="container">
        <Heading as="h2" className={styles.sectionHeading}>
          Real benchmark: GitHub Issues + Slack notification
        </Heading>
        <p className={styles.sectionSubheading}>
          Fetch open issues, filter, format, post to Slack.
        </p>
        <div className="token-comparison">
          <div className="token-comparison__col token-comparison__col--before">
            <div className="token-comparison__label">Without mcp-exec</div>
            <div className="token-comparison__number">43,800</div>
            <div className="token-comparison__desc">
              tokens consumed — full API responses, pagination, raw JSON all
              flow through context
            </div>
          </div>
          <div className="token-comparison__col token-comparison__col--after">
            <div className="token-comparison__label">With mcp-exec</div>
            <div className="token-comparison__number">90</div>
            <div className="token-comparison__desc">
              tokens consumed — only the final Slack confirmation returns to
              Claude
            </div>
          </div>
        </div>
        <p className={styles.reductionNote}>
          <strong>99.8% reduction.</strong> The sandbox fetches, filters, and
          posts. Claude sees the result, not the journey.
        </p>
      </div>
    </section>
  );
}

function InstallSection() {
  return (
    <section className={styles.installSection}>
      <div className="container">
        <Heading as="h2" className={styles.sectionHeading}>
          Install in 30 seconds
        </Heading>
        <p className={styles.sectionSubheading}>
          Via the Claude Code plugin marketplace:
        </p>
        <pre className={styles.installSnippet}>
          <code>{`/plugin install @joeblackwaslike2/mcp-exec`}</code>
        </pre>
        <p className={styles.installAlt}>
          Or manually via npm:{' '}
          <code>npx @joeblackwaslike2/mcp-exec</code>
        </p>
        <div className={styles.installCta}>
          <Link
            className="button button--primary button--lg"
            to="/docs/guide/installation">
            Full Installation Guide
          </Link>
        </div>
      </div>
    </section>
  );
}

function AgentsSection() {
  return (
    <section className={styles.agentsSection}>
      <div className="container">
        <Heading as="h2" className={styles.sectionHeading}>
          Works with the agents you already use
        </Heading>
        <div className={styles.agentBadges}>
          {AGENTS.map((name) => (
            <span key={name} className="agent-badge">
              {name}
            </span>
          ))}
        </div>
        <p className={styles.agentsNote}>
          Any agent that speaks MCP can benefit. No lock-in, no hosted infra,
          no credential system assumptions.
        </p>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} — ${siteConfig.tagline}`}
      description="mcp-exec routes MCP tool workflows through an OS-level sandbox so intermediate data never enters the context window. 52,000 tokens → 50 tokens.">
      <Hero />
      <main>
        <FeaturesSection />
        <TokenComparison />
        <InstallSection />
        <AgentsSection />
      </main>
    </Layout>
  );
}
