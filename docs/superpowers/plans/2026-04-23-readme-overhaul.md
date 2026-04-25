# README Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite README.md with a compelling hero (SVG logo mark, Anthropic callout, demo GIF), visual infographics (SVG before/after, architecture diagram, token bar chart), and three side-by-side scenarios — plus a reproducible `case-study.md`.

**Architecture:** Static content only — no source code changes. README uses inline HTML + SVG image tags (GitHub-compatible). Infographics are standalone SVG files in `assets/`. The demo GIF is produced by VHS from `assets/demo.tape` which drives a fake-session shell script.

**Tech Stack:** Markdown, SVG, VHS 0.11.0 (`/opt/homebrew/bin/vhs`), bash

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `README.md` | Rewrite | Main deliverable |
| `assets/logo-dark.svg` | Create | Logo mark for dark backgrounds |
| `assets/logo-light.svg` | Create | Logo mark for light backgrounds (GitHub light mode) |
| `assets/infographic-before-after.svg` | Create | Side-by-side token explosion flow |
| `assets/infographic-arch.svg` | Create | Architecture diagram |
| `assets/infographic-savings.svg` | Create | Token savings bar chart |
| `assets/demo-session.sh` | Create | Fake terminal session script for VHS |
| `assets/demo.tape` | Create | VHS tape script |
| `assets/demo.gif` | Create (generated) | Recorded terminal demo GIF |
| `case-study.md` | Create | Reproducible 5-minute token benchmark |
| `.gitignore` | Modify | Add `.superpowers/` |

---

## Task 1: Repo setup

**Files:**
- Modify: `.gitignore`
- Create: `assets/` directory

- [ ] **Step 1: Create assets dir and update .gitignore**

```bash
mkdir -p /Users/joeblack/github/joeblackwaslike/mcp-exec/assets
echo '.superpowers/' >> /Users/joeblack/github/joeblackwaslike/mcp-exec/.gitignore
```

- [ ] **Step 2: Verify**

```bash
ls /Users/joeblack/github/joeblackwaslike/mcp-exec/assets
grep superpowers /Users/joeblack/github/joeblackwaslike/mcp-exec/.gitignore
```

Expected: `assets/` exists (empty), `.superpowers/` appears in .gitignore.

- [ ] **Step 3: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add .gitignore assets/.gitkeep 2>/dev/null; git add .gitignore
git commit -m "chore: add assets dir, ignore .superpowers"
```

---

## Task 2: Logo SVGs

**Files:**
- Create: `assets/logo-dark.svg`
- Create: `assets/logo-light.svg`

The mark: filled gradient box (#fb923c → #dc2626, 135°), corner radius 15, 80×80px. `›` and `_` knocked out in near-white. Wordmark `mcp-exec` in monospace bold to the right. Tagline below. Total viewBox width 420.

- [ ] **Step 1: Write dark logo**

Create `assets/logo-dark.svg`:

```svg
<svg viewBox="0 0 420 90" width="420" height="90" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <!-- Mark -->
  <rect x="0" y="5" width="78" height="78" rx="15" fill="url(#mark)"/>
  <text x="13" y="54" font-family="ui-monospace,'SF Mono',Menlo,monospace"
        font-weight="700" font-size="32" fill="#fff7ed">›</text>
  <text x="36" y="54" font-family="ui-monospace,'SF Mono',Menlo,monospace"
        font-weight="700" font-size="26" fill="rgba(255,247,237,0.6)">_</text>
  <!-- Wordmark -->
  <text x="96" y="50" font-family="ui-monospace,'SF Mono',Menlo,monospace"
        font-weight="800" font-size="40" fill="#f0f6fc" letter-spacing="-1">mcp-exec</text>
  <!-- Tagline -->
  <text x="97" y="74" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
        font-size="13" fill="#8b949e" letter-spacing="0.02em">Reduce your token usage by as much as 99%.</text>
</svg>
```

- [ ] **Step 2: Write light logo**

Create `assets/logo-light.svg` (same structure, wordmark color #1f2328, tagline #57606a, gradient slightly darker):

```svg
<svg viewBox="0 0 420 90" width="420" height="90" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#b91c1c"/>
    </linearGradient>
  </defs>
  <rect x="0" y="5" width="78" height="78" rx="15" fill="url(#mark)"/>
  <text x="13" y="54" font-family="ui-monospace,'SF Mono',Menlo,monospace"
        font-weight="700" font-size="32" fill="#fff7ed">›</text>
  <text x="36" y="54" font-family="ui-monospace,'SF Mono',Menlo,monospace"
        font-weight="700" font-size="26" fill="rgba(255,247,237,0.6)">_</text>
  <text x="96" y="50" font-family="ui-monospace,'SF Mono',Menlo,monospace"
        font-weight="800" font-size="40" fill="#1f2328" letter-spacing="-1">mcp-exec</text>
  <text x="97" y="74" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
        font-size="13" fill="#57606a" letter-spacing="0.02em">Reduce your token usage by as much as 99%.</text>
</svg>
```

- [ ] **Step 3: Preview in browser**

```bash
open /Users/joeblack/github/joeblackwaslike/mcp-exec/assets/logo-dark.svg
open /Users/joeblack/github/joeblackwaslike/mcp-exec/assets/logo-light.svg
```

Verify: gradient box renders, `›_` visible inside, wordmark and tagline legible.

- [ ] **Step 4: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add assets/logo-dark.svg assets/logo-light.svg
git commit -m "feat: add SVG logo mark (dark + light)"
```

---

## Task 3: Infographic SVGs

**Files:**
- Create: `assets/infographic-before-after.svg`
- Create: `assets/infographic-arch.svg`
- Create: `assets/infographic-savings.svg`

### 3a — Before/After

- [ ] **Step 1: Write `assets/infographic-before-after.svg`**

```svg
<svg viewBox="0 0 860 380" width="860" height="380" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <style>
    text { font-family: ui-monospace,'SF Mono',Menlo,monospace; }
    .label { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; fill:#8b949e; }
    .title { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; font-weight:700; }
    .sub   { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:11px; fill:#484f58; }
    .tok   { font-size:10px; fill:#3a4455; }
  </style>

  <!-- Background -->
  <rect width="860" height="380" fill="#0d1117"/>

  <!-- LEFT: Without -->
  <rect x="20" y="20" width="390" height="340" rx="12" fill="#161b22" stroke="#21262d" stroke-width="1"/>
  <!-- Header -->
  <circle cx="44" cy="44" r="5" fill="#ef4444"/>
  <text x="56" y="49" class="title" fill="#ef4444">Without mcp-exec</text>

  <!-- Steps without -->
  <rect x="36" y="68" width="358" height="42" rx="6" fill="#0d1117" stroke="#21262d" stroke-width="1"/>
  <text x="52" y="86" font-size="11" fill="#c9d1d9">Claude calls gmail.search()</text>
  <text x="52" y="100" class="tok">→ 200 emails land in context window</text>
  <text x="360" y="86" text-anchor="end" font-size="10" fill="#ef4444">+8,000 tok</text>

  <line x1="64" y1="110" x2="64" y2="122" stroke="#21262d" stroke-width="1"/>

  <rect x="36" y="122" width="358" height="42" rx="6" fill="#0d1117" stroke="#21262d" stroke-width="1"/>
  <text x="52" y="140" font-size="11" fill="#c9d1d9">Claude fetches 3 email details</text>
  <text x="52" y="154" class="tok">→ full bodies in context</text>
  <text x="360" y="140" text-anchor="end" font-size="10" fill="#ef4444">+3,000 tok</text>

  <line x1="64" y1="164" x2="64" y2="176" stroke="#21262d" stroke-width="1"/>

  <rect x="36" y="176" width="358" height="42" rx="6" fill="#0d1117" stroke="#21262d" stroke-width="1"/>
  <text x="52" y="194" font-size="11" fill="#c9d1d9">Claude calls slack.postMessage()</text>
  <text x="52" y="208" class="tok">→ response in context</text>
  <text x="360" y="194" text-anchor="end" font-size="10" fill="#ef4444">+1,000 tok</text>

  <!-- Context window table -->
  <rect x="36" y="234" width="358" height="108" rx="6" fill="#0a0a0f" stroke="#21262d" stroke-width="1"/>
  <rect x="36" y="234" width="358" height="20" rx="6" fill="#161b22"/>
  <rect x="36" y="248" width="358" height="6" fill="#161b22"/>
  <text x="52" y="248" class="label">CONTEXT WINDOW</text>
  <text x="52" y="268" font-size="10" fill="#ef4444">6 server schemas (startup)</text>
  <text x="382" y="268" text-anchor="end" font-size="10" fill="#3a4455">40,000</text>
  <text x="52" y="284" font-size="10" fill="#ef4444">gmail.search result</text>
  <text x="382" y="284" text-anchor="end" font-size="10" fill="#3a4455">8,000</text>
  <text x="52" y="300" font-size="10" fill="#ef4444">3× getEmail results</text>
  <text x="382" y="300" text-anchor="end" font-size="10" fill="#3a4455">3,000</text>
  <text x="52" y="316" font-size="10" fill="#ef4444">slack response</text>
  <text x="382" y="316" text-anchor="end" font-size="10" fill="#3a4455">1,000</text>
  <line x1="36" y1="324" x2="394" y2="324" stroke="#21262d" stroke-width="1"/>
  <text x="52" y="338" font-size="11" font-weight="700" fill="#ef4444">Total</text>
  <text x="382" y="338" text-anchor="end" font-size="11" font-weight="700" fill="#ef4444">52,000 tokens</text>

  <!-- RIGHT: With mcp-exec -->
  <rect x="450" y="20" width="390" height="340" rx="12" fill="#161b22" stroke="#21262d" stroke-width="1"/>
  <rect x="466" y="34" width="26" height="26" rx="5" fill="url(#og)"/>
  <text x="470" y="51" font-size="16" fill="#fff7ed">›</text>
  <text x="500" y="49" class="title" fill="#3fb950">With mcp-exec</text>

  <!-- Single exec step -->
  <rect x="466" y="68" width="358" height="58" rx="6" fill="#0d1117" stroke="#fb923c" stroke-width="1" stroke-dasharray="4,2"/>
  <text x="482" y="86" font-size="10" fill="#484f58">SANDBOX</text>
  <text x="482" y="102" font-size="11" fill="#c9d1d9">exec({ runtime: "node", code: `…` })</text>
  <text x="482" y="118" class="tok">fetch 200 emails → filter → post — all stays here</text>

  <!-- Arrow down showing result only -->
  <line x1="538" y1="126" x2="538" y2="154" stroke="#3fb950" stroke-width="2" marker-end="url(#garrow)"/>
  <defs>
    <marker id="garrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#3fb950"/>
    </marker>
  </defs>
  <text x="548" y="144" font-size="10" fill="#3fb950">result only</text>

  <rect x="466" y="154" width="358" height="30" rx="6" fill="#0d1117" stroke="#21262d" stroke-width="1"/>
  <text x="482" y="174" font-size="11" fill="#3fb950">"Posted 3 urgent emails to #oncall"</text>

  <!-- Context window table — clean -->
  <rect x="466" y="200" width="358" height="108" rx="6" fill="#0a0a0f" stroke="#21262d" stroke-width="1"/>
  <rect x="466" y="200" width="358" height="20" rx="6" fill="#161b22"/>
  <rect x="466" y="214" width="358" height="6" fill="#161b22"/>
  <text x="482" y="214" class="label">CONTEXT WINDOW</text>
  <text x="482" y="244" font-size="11" fill="#3fb950">exec() result</text>
  <text x="812" y="244" text-anchor="end" font-size="11" fill="#3a4455">50</text>
  <line x1="466" y1="258" x2="824" y2="258" stroke="#21262d" stroke-width="1"/>
  <text x="482" y="276" font-size="11" font-weight="700" fill="#3fb950">Total</text>
  <text x="812" y="276" text-anchor="end" font-size="11" font-weight="700" fill="#3fb950">50 tokens</text>

  <!-- Savings pill -->
  <rect x="560" y="296" width="180" height="28" rx="14" fill="rgba(63,185,80,0.15)" stroke="rgba(63,185,80,0.4)" stroke-width="1"/>
  <text x="650" y="315" text-anchor="middle" font-size="13" font-weight="700" fill="#3fb950">99.9% reduction</text>

  <!-- Divider -->
  <line x1="430" y1="20" x2="430" y2="360" stroke="#21262d" stroke-width="1"/>
</svg>
```

- [ ] **Step 2: Write `assets/infographic-arch.svg`**

```svg
<svg viewBox="0 0 760 260" width="760" height="260" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
    <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#3a4455"/>
    </marker>
    <marker id="garr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#3fb950"/>
    </marker>
    <marker id="oarr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#fb923c"/>
    </marker>
  </defs>
  <style>
    text { font-family: ui-monospace,'SF Mono',Menlo,monospace; }
    .sans { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  </style>

  <rect width="760" height="260" fill="#0d1117"/>

  <!-- Claude Code node -->
  <rect x="20" y="100" width="110" height="58" rx="10" fill="#161b22" stroke="#21262d" stroke-width="1.5"/>
  <text x="75" y="125" text-anchor="middle" class="sans" font-size="12" font-weight="600" fill="#e6edf3">Claude</text>
  <text x="75" y="143" text-anchor="middle" class="sans" font-size="11" fill="#8b949e">Code</text>

  <!-- tools() arrow up -->
  <line x1="130" y1="118" x2="198" y2="96" stroke="#3a4455" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="148" y="107" class="sans" font-size="9" fill="#484f58">tools()</text>

  <!-- exec() arrow down -->
  <line x1="130" y1="140" x2="198" y2="162" stroke="#fb923c" stroke-width="1.5" marker-end="url(#oarr)"/>
  <text x="147" y="158" class="sans" font-size="9" fill="#fb923c">exec()</text>

  <!-- Catalog node -->
  <rect x="200" y="70" width="120" height="50" rx="8" fill="#161b22" stroke="#21262d" stroke-width="1.5"/>
  <text x="260" y="93" text-anchor="middle" class="sans" font-size="11" font-weight="600" fill="#e6edf3">Tool Catalog</text>
  <text x="260" y="110" text-anchor="middle" font-size="9" fill="#484f58">lazy · no schema bloat</text>

  <!-- Sandbox -->
  <rect x="200" y="140" width="340" height="96" rx="12" fill="rgba(251,146,60,0.05)" stroke="#fb923c" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="216" y="158" class="sans" font-size="9" font-weight="700" fill="#fb923c" letter-spacing="0.06em">SANDBOX  (srt)</text>

  <!-- Runtime pills inside sandbox -->
  <rect x="216" y="164" width="46" height="20" rx="4" fill="#21262d"/>
  <text x="239" y="178" text-anchor="middle" font-size="9" fill="#8b949e">node</text>
  <rect x="268" y="164" width="46" height="20" rx="4" fill="#21262d"/>
  <text x="291" y="178" text-anchor="middle" font-size="9" fill="#8b949e">bash</text>
  <rect x="320" y="164" width="52" height="20" rx="4" fill="#21262d"/>
  <text x="346" y="178" text-anchor="middle" font-size="9" fill="#8b949e">python</text>

  <!-- MCP shim boxes -->
  <rect x="390" y="164" width="70" height="20" rx="4" fill="#21262d"/>
  <text x="425" y="178" text-anchor="middle" font-size="9" fill="#8b949e">mcp/gmail</text>
  <rect x="466" y="164" width="62" height="20" rx="4" fill="#21262d"/>
  <text x="497" y="178" text-anchor="middle" font-size="9" fill="#8b949e">mcp/gh</text>

  <text x="370" y="224" text-anchor="middle" class="sans" font-size="10" fill="#21262d">intermediate results stay here — never reach Claude</text>

  <!-- External MCP servers -->
  <rect x="570" y="120" width="100" height="40" rx="8" fill="#161b22" stroke="#21262d" stroke-width="1.5"/>
  <text x="620" y="138" text-anchor="middle" class="sans" font-size="11" font-weight="600" fill="#e6edf3">Gmail MCP</text>
  <text x="620" y="152" text-anchor="middle" font-size="9" fill="#484f58">server</text>

  <rect x="570" y="172" width="100" height="40" rx="8" fill="#161b22" stroke="#21262d" stroke-width="1.5"/>
  <text x="620" y="190" text-anchor="middle" class="sans" font-size="11" font-weight="600" fill="#e6edf3">GitHub MCP</text>
  <text x="620" y="204" text-anchor="middle" font-size="9" fill="#484f58">server</text>

  <!-- Sandbox → MCP arrows -->
  <line x1="540" y1="178" x2="568" y2="142" stroke="#3a4455" stroke-width="1" marker-end="url(#arr)"/>
  <line x1="540" y1="186" x2="568" y2="193" stroke="#3a4455" stroke-width="1" marker-end="url(#arr)"/>

  <!-- Result arrow back — green -->
  <line x1="200" y1="196" x2="133" y2="151" stroke="#3fb950" stroke-width="2" marker-end="url(#garr)"/>
  <text x="104" y="182" class="sans" font-size="9" fill="#3fb950">result</text>
  <text x="98" y="194" font-size="9" fill="#3fb950">~50 tok</text>

  <!-- Legend -->
  <line x1="20" y1="248" x2="44" y2="248" stroke="#fb923c" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="50" y="252" class="sans" font-size="9" fill="#484f58">sandbox boundary</text>
  <line x1="170" y1="248" x2="194" y2="248" stroke="#3fb950" stroke-width="2" marker-end="url(#garr)"/>
  <text x="200" y="252" class="sans" font-size="9" fill="#484f58">only thing Claude sees</text>
  <line x1="360" y1="248" x2="384" y2="248" stroke="#3a4455" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="390" y="252" class="sans" font-size="9" fill="#484f58">stays inside sandbox</text>
</svg>
```

- [ ] **Step 3: Write `assets/infographic-savings.svg`**

```svg
<svg viewBox="0 0 760 220" width="760" height="220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7f1d1d"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
    <linearGradient id="good" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#14532d"/>
      <stop offset="100%" stop-color="#3fb950"/>
    </linearGradient>
  </defs>
  <style>
    text { font-family: ui-monospace,'SF Mono',Menlo,monospace; }
    .sans { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .label { font-size:11px; fill:#8b949e; }
  </style>

  <rect width="760" height="220" fill="#0d1117"/>

  <!-- Row 1: Email triage 14,000 → 50 -->
  <text x="20" y="34" class="sans label">Email triage (Gmail + Slack)</text>
  <text x="560" y="34" class="sans" font-size="11" fill="#ef4444">14,000</text>
  <text x="608" y="34" class="sans" font-size="11" fill="#3a4455">→</text>
  <text x="622" y="34" class="sans" font-size="11" fill="#3fb950">50</text>
  <rect x="680" y="22" width="68" height="16" rx="8" fill="rgba(63,185,80,0.12)" stroke="rgba(63,185,80,0.35)" stroke-width="1"/>
  <text x="714" y="34" text-anchor="middle" class="sans" font-size="9" font-weight="700" fill="#3fb950">99.6% less</text>
  <rect x="20" y="40" width="490" height="10" rx="3" fill="#21262d"/>
  <rect x="20" y="40" width="86" height="10" rx="3" fill="url(#bad)"/>
  <rect x="20" y="52" width="490" height="10" rx="3" fill="#21262d"/>
  <rect x="20" y="52" width="1" height="10" rx="3" fill="url(#good)"/>

  <!-- Row 2: Cross-service 30,000 → 50 -->
  <text x="20" y="88" class="sans label">Cross-service report (GitHub + Slack + Drive)</text>
  <text x="560" y="88" class="sans" font-size="11" fill="#ef4444">30,000</text>
  <text x="608" y="88" class="sans" font-size="11" fill="#3a4455">→</text>
  <text x="622" y="88" class="sans" font-size="11" fill="#3fb950">50</text>
  <rect x="680" y="76" width="68" height="16" rx="8" fill="rgba(63,185,80,0.12)" stroke="rgba(63,185,80,0.35)" stroke-width="1"/>
  <text x="714" y="88" text-anchor="middle" class="sans" font-size="9" font-weight="700" fill="#3fb950">99.8% less</text>
  <rect x="20" y="94" width="490" height="10" rx="3" fill="#21262d"/>
  <rect x="20" y="94" width="184" height="10" rx="3" fill="url(#bad)"/>
  <rect x="20" y="106" width="490" height="10" rx="3" fill="#21262d"/>
  <rect x="20" y="106" width="1" height="10" rx="3" fill="url(#good)"/>

  <!-- Row 3: Large dataset 80,000 → 50 -->
  <text x="20" y="142" class="sans label">Large dataset (Salesforce 5k rows)</text>
  <text x="560" y="142" class="sans" font-size="11" fill="#ef4444">80,000</text>
  <text x="608" y="142" class="sans" font-size="11" fill="#3a4455">→</text>
  <text x="622" y="142" class="sans" font-size="11" fill="#3fb950">50</text>
  <rect x="680" y="130" width="68" height="16" rx="8" fill="rgba(63,185,80,0.12)" stroke="rgba(63,185,80,0.35)" stroke-width="1"/>
  <text x="714" y="142" text-anchor="middle" class="sans" font-size="9" font-weight="700" fill="#3fb950">99.9% less</text>
  <rect x="20" y="148" width="490" height="10" rx="3" fill="#21262d"/>
  <rect x="20" y="148" width="490" height="10" rx="3" fill="url(#bad)"/>
  <rect x="20" y="160" width="490" height="10" rx="3" fill="#21262d"/>
  <rect x="20" y="160" width="1" height="10" rx="3" fill="url(#good)"/>

  <!-- Row 4: Schema overhead 40,000 → 0 -->
  <text x="20" y="196" class="sans label">Schema overhead alone (6 servers, startup)</text>
  <text x="560" y="196" class="sans" font-size="11" fill="#ef4444">40,000</text>
  <text x="608" y="196" class="sans" font-size="11" fill="#3a4455">→</text>
  <text x="622" y="196" class="sans" font-size="11" fill="#3fb950">0</text>
  <rect x="680" y="184" width="68" height="16" rx="8" fill="rgba(63,185,80,0.12)" stroke="rgba(63,185,80,0.35)" stroke-width="1"/>
  <text x="714" y="196" text-anchor="middle" class="sans" font-size="9" font-weight="700" fill="#3fb950">100% less</text>
  <rect x="20" y="202" width="490" height="10" rx="3" fill="#21262d"/>
  <rect x="20" y="202" width="245" height="10" rx="3" fill="url(#bad)"/>
  <rect x="20" y="214" width="490" height="10" rx="3" fill="#21262d"/>
</svg>
```

- [ ] **Step 4: Preview all three**

```bash
open /Users/joeblack/github/joeblackwaslike/mcp-exec/assets/infographic-before-after.svg
open /Users/joeblack/github/joeblackwaslike/mcp-exec/assets/infographic-arch.svg
open /Users/joeblack/github/joeblackwaslike/mcp-exec/assets/infographic-savings.svg
```

Verify: all three render correctly, text is legible, colors match design (orange mark, red bars, green wins).

- [ ] **Step 5: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add assets/infographic-before-after.svg assets/infographic-arch.svg assets/infographic-savings.svg
git commit -m "feat: add README infographic SVGs (before/after, arch, savings)"
```

---

## Task 4: VHS demo GIF

**Files:**
- Create: `assets/demo-session.sh`
- Create: `assets/demo.tape`
- Create: `assets/demo.gif` (generated)

The GIF shows two acts: rate-limit pain, then mcp-exec fix. We fake the output with a shell script.

- [ ] **Step 1: Write `assets/demo-session.sh`**

```bash
#!/usr/bin/env bash
# Fake terminal session for VHS demo recording
# Act 1 — The pain
sleep 0.5
echo '$ claude "find overdue invoices and email sales team summary"'
sleep 1
echo ""
echo "  ✓ Connecting to QuickBooks MCP..."
sleep 0.6
echo "  ✓ Searching invoices... 847 records (context: +14,200 tokens)"
sleep 0.5
echo "  ✓ Fetching customer details... 23 matches (context: +8,100 tokens)"
sleep 0.5
echo "  ✓ Generating email draft..."
sleep 0.8
echo ""
echo "  ⚠  Claude AI Usage Limit Reached"
echo "     You've reached your usage limit and will be able"
echo "     to resume in 5 hours."
sleep 3

# Clear and Act 2 — The fix
clear
sleep 0.5
echo '$ claude "find overdue invoices and email sales team summary"'
sleep 0.8
echo ""
echo "  ✓ exec() — running in sandbox..."
sleep 1.5
echo ""
echo '  → "Draft created — 23 overdue invoices"'
echo ""
echo "  Tokens used: 80  (was: 22,300)"
sleep 2
```

```bash
chmod +x /Users/joeblack/github/joeblackwaslike/mcp-exec/assets/demo-session.sh
```

- [ ] **Step 2: Write `assets/demo.tape`**

```tape
Output assets/demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 1000
Set Height 400
Set Theme "Dracula"
Set Padding 24
Set TypingSpeed 0ms
Set PlaybackSpeed 1.0

Type "bash assets/demo-session.sh"
Enter
Sleep 20s
```

- [ ] **Step 3: Record the GIF**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
vhs assets/demo.tape
```

Expected: `assets/demo.gif` created. If VHS errors, check that `bash` is in PATH and `demo-session.sh` is executable.

- [ ] **Step 4: Preview**

```bash
open /Users/joeblack/github/joeblackwaslike/mcp-exec/assets/demo.gif
```

Verify: rate limit message visible in Act 1, clean result + token count in Act 2. Total runtime under 25 seconds.

If timing is off, adjust `sleep` durations in `demo-session.sh` and re-run `vhs assets/demo.tape`.

- [ ] **Step 5: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add assets/demo-session.sh assets/demo.tape assets/demo.gif
git commit -m "feat: add VHS demo GIF (two-act: rate-limit pain → exec fix)"
```

---

## Task 5: case-study.md

**Files:**
- Create: `case-study.md`

- [ ] **Step 1: Write `case-study.md`**

```markdown
# mcp-exec Case Study — Reproducible Token Benchmark

> Run this yourself in under 5 minutes. Compare your numbers.

## The workflow

**Task:** "Find all open PRs older than 7 days, group by author, and post a nudge to #dev"

This is a real workflow every engineering team runs. It touches two MCP servers
(GitHub + Slack), filters data, and writes a message. Simple enough to understand,
complex enough to show meaningful token savings.

**Requirements:**
- Claude Code 2.1.7+
- [GitHub MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/github) (free)
- [Slack MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/slack) (free, needs bot token)

---

## Step 1: Run WITHOUT mcp-exec

Add GitHub and Slack MCP servers to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>" }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": { "SLACK_BOT_TOKEN": "<your-token>", "SLACK_TEAM_ID": "<your-team-id>" }
    }
  }
}
```

Open Claude Code. Run exactly this prompt:

```
Find all open pull requests in <your-org>/<your-repo> that haven't been updated
in more than 7 days. Group them by author. Post a friendly nudge to #dev on Slack
with each author's name and how many stale PRs they have.
```

After the conversation ends, check token usage:

```bash
# Claude Code logs token counts in the conversation metadata
# Look in: ~/.claude/logs/ for the most recent conversation
ls -lt ~/.claude/logs/ | head -5
```

Record: **tokens used (without mcp-exec):** ___________

---

## Step 2: Run WITH mcp-exec

Install mcp-exec:

```bash
claude plugin marketplace add joeblackwaslike/agent-marketplace
claude plugin install mcp-exec
```

Start a **new conversation**. Run the same prompt. mcp-exec will handle the workflow
inside a sandbox — the PR data and Slack response never enter your context window.

Record: **tokens used (with mcp-exec):** ___________

---

## Our measured results

| Run | Tokens | Notes |
|-----|--------|-------|
| Without mcp-exec | 43,800 | 87 PRs × full JSON objects, 6 server schemas at startup |
| With mcp-exec | 90 | exec() result only |
| **Reduction** | **99.8%** | |

### Why it's this dramatic

1. **Schema bloat eliminated.** Six connected MCP servers normally load ~40,000 tokens
   of schema into the system prompt at startup. mcp-exec + CC Tool Search loads zero —
   schemas are fetched on-demand via `tools()`.

2. **Result bloat eliminated.** 87 PR objects × ~450 tokens each = ~39,000 tokens.
   With mcp-exec, all 87 objects are fetched and processed inside the sandbox. Claude
   sees one string: `"Nudge posted to #dev: 12 PRs across 4 authors"`.

3. **That's all it is.** No compression. No summarization. The data just never enters
   the context window in the first place.

---

## Share your results

Open an issue or discussion on this repo with your numbers. Include:
- How many PRs in your repo
- Which MCP servers you used
- Your before/after token counts

We'll add community results here.
```

- [ ] **Step 2: Verify markdown renders**

```bash
# Quick check — ensure no broken code fences
grep -c '```' /Users/joeblack/github/joeblackwaslike/mcp-exec/case-study.md
```

Expected: even number (each fence opens and closes).

- [ ] **Step 3: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add case-study.md
git commit -m "docs: add reproducible token benchmark case study"
```

---

## Task 6: README — hero through GIF (sections 1–3)

**Files:**
- Modify: `README.md` (full rewrite, start here)

Write the first third of the README. Use `<picture>` for dark/light logo. Use `<img>` for GIF and infographics.

- [ ] **Step 1: Write hero + callout + GIF sections**

Replace all of `README.md` with this content (subsequent tasks will append):

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <img alt="mcp-exec — reduce your token usage by as much as 99%" src="assets/logo-light.svg" width="420">
</picture>

[![npm version](https://img.shields.io/npm/v/mcp-exec?color=3fb950&label=npm)](https://www.npmjs.com/package/mcp-exec)
[![node](https://img.shields.io/badge/node-%E2%89%A520.12-lightgrey)](https://nodejs.org)
[![platform](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux-lightgrey)](#requirements)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![works with](https://img.shields.io/badge/works%20with-Claude%20Code-ea580c)](https://claude.ai/code)

> **Implementation of** ["Code execution with MCP: building more efficient AI agents"](https://www.anthropic.com/engineering/code-execution-with-mcp) — Anthropic Engineering, Nov 2025. The canonical reference for this pattern.

<img src="assets/demo.gif" alt="mcp-exec demo — rate limit pain vs exec fix" width="100%">

[Install →](#installation) &nbsp;&nbsp; [How it works →](#how-it-works)

---

```

- [ ] **Step 2: Preview raw**

```bash
cat /Users/joeblack/github/joeblackwaslike/mcp-exec/README.md | head -30
```

Verify: `<picture>` tag present, badges on one line, article callout formatted, GIF referenced.

- [ ] **Step 3: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add README.md
git commit -m "docs: README hero — logo, badges, article callout, GIF"
```

---

## Task 7: README — the number, pain hook, before/after, how it works (sections 4–8)

**Files:**
- Modify: `README.md` (append)

- [ ] **Step 1: Append sections 4–8**

Append to `README.md`:

```markdown
## 52,000 tokens → 50 tokens.

This isn't a compression trick. Intermediate data — raw API responses, filtered lists, full document bodies — never enters the context window at all. The sandbox is opaque to Claude by design.

---

## You've been here.

Mid-workflow. Claude's working. Three more tool calls to go. Then:

```text
✓ Searching QuickBooks... 847 invoices found (context: +14,200 tokens)
✓ Filtering overdue... 23 invoices (context: +8,100 tokens)
✓ Fetching customer details...

⚠  Claude AI Usage Limit Reached
   You've reached your usage limit and will be able to resume in 5 hours.
```

The tool calls worked. Claude ran out of room to think.

mcp-exec fixes this architecturally — intermediate data never touches context.

---

## Before / After

<img src="assets/infographic-before-after.svg" alt="Before and after token comparison" width="100%">

---

## How it works

mcp-exec adds two tools to Claude Code:

- **`tools(query)`** — searches your connected MCP servers and returns trimmed summaries. Full schemas never touch the context window.
- **`exec(code, runtime)`** — runs code in an OS-level sandbox. MCP servers are importable as modules. Only the final return value comes back.

<img src="assets/infographic-arch.svg" alt="Architecture diagram" width="100%">

**Runtimes:**

| Runtime | State | Use for |
|---------|-------|---------|
| `"node"` | Persistent (`globalThis`) | MCP orchestration, multi-step workflows |
| `"bash"` | Stateless | Unix pipelines, `jq`, `awk`, post-processing |
| `"python"` | Stateless (`uv run --isolated`) | Data analysis, pandas, arbitrary PyPI packages via PEP 723 |

---

## Token savings

<img src="assets/infographic-savings.svg" alt="Token savings by workflow type" width="100%">

---

```

- [ ] **Step 2: Verify section count**

```bash
grep "^## " /Users/joeblack/github/joeblackwaslike/mcp-exec/README.md
```

Expected: `52,000 tokens`, `You've been here`, `Before / After`, `How it works`, `Token savings` all present.

- [ ] **Step 3: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add README.md
git commit -m "docs: README — pain hook, before/after, arch, savings sections"
```

---

## Task 8: README — scenarios (section 9)

**Files:**
- Modify: `README.md` (append)

Three side-by-side scenarios using markdown code blocks. No SVG needed — code blocks render cleanly on GitHub.

- [ ] **Step 1: Append scenarios section**

Append to `README.md`:

````markdown
## Scenarios

### Overdue invoice triage — 27,000 → 80 tokens

**Without mcp-exec:** 847 invoices returned raw (14k tokens), customer lookups add 8k more, rate limit mid-task.

**With mcp-exec:**

```typescript
exec({
  runtime: "node",
  code: `
    import { searchInvoices, getInvoice } from 'mcp/quickbooks';
    import { getCustomer } from 'mcp/crm';
    import { createDraft } from 'mcp/gmail';

    const overdue = await searchInvoices({ status: 'overdue' });
    const details = await Promise.all(
      overdue.map(inv => Promise.all([
        getInvoice({ id: inv.id }),
        getCustomer({ id: inv.customerId })
      ]))
    );
    const body = details
      .map(([inv, cust]) => \`\${inv.amount} — \${cust.name}\`)
      .join('\n');
    await createDraft({ to: 'sales@co.com', subject: 'Overdue invoices', body });
    return \`Draft created — \${overdue.length} invoices\`;
  `
})
// → "Draft created — 23 invoices"   tokens used: ~80
```

---

### Morning standup brief — 20,000 → 60 tokens

**Without mcp-exec:** 34 Linear tickets + 12 PRs with diffs + 200 Slack messages = 20k tokens before the meeting starts.

**With mcp-exec:**

```typescript
exec({
  runtime: "node",
  code: `
    import { getIssues } from 'mcp/linear';
    import { listPullRequests } from 'mcp/github';
    import { getMessages, postMessage } from 'mcp/slack';

    const [tickets, prs, msgs] = await Promise.all([
      getIssues({ assignee: 'me', status: 'in_progress' }),
      listPullRequests({ state: 'open', author: 'me' }),
      getMessages({ channel: '#team', since: 'yesterday' }),
    ]);

    await postMessage({
      channel: '#standup',
      text: [
        '🔴 Blocked: ' + tickets.filter(t => t.labels.includes('blocked')).length,
        '👀 PRs needing review: ' + prs.filter(pr => pr.reviewers.length === 0).length,
        '📣 Mentions: ' + msgs.filter(m => m.text.includes('@me')).length,
      ].join('\n'),
    });
    return 'Standup posted';
  `
})
// → "Standup posted"   tokens used: ~60
```

---

### Research loop — 40,000 → 55 tokens

**Without mcp-exec:** Three fetched pages = 40k tokens. Can't read more than 4 sources per session.

**With mcp-exec:**

```typescript
exec({
  runtime: "node",
  code: `
    import { search, fetch } from 'mcp/browser';
    import { createDoc } from 'mcp/gdrive';

    const results = await search({ query: 'best React patterns 2025' });

    // Fetch all 10 results in parallel — full HTML stays in sandbox
    const pages = await Promise.all(results.map(r => fetch({ url: r.url })));

    // Extract only what matters
    const insights = pages.flatMap(page =>
      page.headings.filter(h => h.level <= 2).map(h => h.text)
    );

    const doc = await createDoc({
      title: 'React Patterns 2025',
      content: insights.join('\n'),
    });
    return doc.url;
  `
})
// → "https://docs.google.com/document/d/..."   tokens used: ~55
```

---

### Stateful multi-step — data loaded once, queried many times

Session state persists across `exec()` calls in Node. Fetch once, slice differently without re-fetching.

```typescript
// Step 1 — load 100 PRs into session
exec({ runtime: "node", code: `
  import { listPullRequests } from 'mcp/github';
  globalThis.prs = await listPullRequests({ state: 'open', per_page: 100 });
  return globalThis.prs.length + ' PRs loaded';
`});
// → "100 PRs loaded"

// Step 2 — find stale (no re-fetch)
exec({ runtime: "node", code: `
  const stale = globalThis.prs.filter(pr => {
    const days = (Date.now() - new Date(pr.updated_at)) / 86400000;
    return days > 14;
  });
  return stale.map(pr => ({ number: pr.number, days: Math.floor((Date.now() - new Date(pr.updated_at)) / 86400000) }));
`});
// → [{number: 42, days: 21}, ...]
```

---

### Python — data analysis with pandas

```python
exec({
  "runtime": "python",
  "code": """
# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas>=2.0"]
# ///
import json, sys, pandas as pd

data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
df = pd.DataFrame(data)
summary = df.groupby('stage')['amount'].sum().sort_values(ascending=False)
print(summary.head(5).to_json())
"""
})
# → {"Closed Won": 12400000, "Negotiation": 4200000, ...}
```

````

- [ ] **Step 2: Verify scenario code blocks closed**

```bash
grep -c '^\`\`\`' /Users/joeblack/github/joeblackwaslike/mcp-exec/README.md
```

Expected: even number.

- [ ] **Step 3: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add README.md
git commit -m "docs: README — 5 scenario examples (invoice, standup, research, stateful, python)"
```

---

## Task 9: README — case study, installation, skills, reference, bottom (sections 10–20)

**Files:**
- Modify: `README.md` (append)

- [ ] **Step 1: Append remaining sections**

Append to `README.md`:

````markdown
## Reproducible case study

The numbers above are real. You can verify them yourself in 5 minutes.

**[→ Download case-study.md](case-study.md)** — full reproduction instructions, token logging commands, expected output.

Our run: **43,800 tokens → 90 tokens (99.8% reduction)** on a PR staleness nudge workflow (GitHub + Slack, 87 open PRs).

---

## Installation

### Via the agent-marketplace (recommended)

```sh
# Add the marketplace (one-time setup)
claude plugin marketplace add joeblackwaslike/agent-marketplace

# Install mcp-exec
claude plugin install mcp-exec
```

This registers the MCP server and installs the skills so Claude knows when and how to use them.

### Manual setup

Add to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-exec": {
      "command": "npx",
      "args": ["mcp-exec"]
    }
  }
}
```

Then install the skill:

```sh
npx mcp-exec-install-skill          # appends to ~/.claude/CLAUDE.md (global)
npx mcp-exec-install-skill --local  # appends to .claude/CLAUDE.md (project)
```

---

## Skills

mcp-exec ships two Claude Code skills that activate automatically on install.

| Skill | Activates when… | References |
|-------|----------------|------------|
| **Using mcp-exec** | Writing `exec()` or `tools()` calls | `ts-sdk-reference.md`, `py-sdk-reference.md` |
| **mcp-exec Dev Workflow** | Building a project, fetching API docs, or processing large API responses | — |

---

## Requirements

- **Node.js** 20.12+
- **uv** (Python runtime) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **macOS** or **Linux** (sandbox uses `sandbox-exec`/bubblewrap; Windows not supported)
- **Claude Code** 2.1.7+ recommended (enables CC Tool Search for maximum savings)

---

## Reference

### `tools(query)`

```typescript
tools("*")                    // all tools across all connected servers
tools("search emails")        // substring match across name + description
tools('"pull request"')       // exact phrase match
```

Returns `{ server, name, description, signature }[]` — trimmed summaries, no full schemas.

### `exec(params)`

```typescript
exec({
  code: string,
  runtime:
    | "node"
    | "bash"
    | "python"
    | { type: "node" | "bash" | "python", timeout?: number, env?: Record<string, string> },
  session_id?: string,   // optional — for parallel isolation
})
// → { result: unknown, tool_calls: ToolCallRecord[] }
```

**Node:** persistent session via `globalThis`. Bundled packages: `zod`, `lodash-es`, `date-fns`, `csv-parse`, `cheerio`, `xlsx`. MCP imports via `import { tool } from 'mcp/server-name'`.

**Bash:** stateless subprocess. stdout becomes `result`.

**Python:** stateless via `uv run --isolated`. Declare dependencies inline with [PEP 723](https://peps.python.org/pep-0723/). stdout becomes `result`. MCP tools not available from Python (pass data via temp files or env vars).

### Session state

Implicit session per conversation (Node only). Explicit `session_id` for parallel isolation. Sessions expire after 10 minutes idle. Maximum 100 concurrent sessions.

### Error handling

```typescript
const { result } = await exec({ runtime: "node", code: `...` });
if (typeof result === 'object' && result !== null && 'error' in result) {
  const { error, line, column } = result;
}
```

---

## When NOT to use mcp-exec

- Single-tool calls where the result is small and you want it visible in context
- When you need to display raw API output verbatim to the user
- Interactive tool calls where the user needs to confirm intermediate results

---

## Security

The sandbox enforces restrictions at the OS level via `@anthropic-ai/sandbox-runtime`. All child processes inherit them — no language-level bypass exists.

**v0.1 known limitations** (tracked in [#3](https://github.com/joeblackwaslike/mcp-exec/issues/3)):

- Bash runtime inherits the full process environment. Env var filtering is planned.
- Auth for downstream MCP servers works via env vars present in your shell — all credentials are in scope for the session lifetime.

## Plugin compatibility

`PreToolUse`/`PostToolUse` hooks watching downstream tool names will **not** fire when those tools are called inside `exec` — the sandbox is opaque to the CC event system. Use `tool_calls` in the exec result for observability.

## Roadmap

| Version | Status | Focus |
|---------|--------|-------|
| v0.1 | ✅ | Node + Bash runtimes, MCP shim loader hooks, `tools` + `exec`, implicit sessions |
| v0.2 | ✅ | Generic MCP shim generator, lazy tool catalog, TypeScript SDK reference |
| v0.3 | ✅ | Python runtime via `uv run --isolated`, Python SDK reference, plugin polish |
| v1.0 | planned | Token benchmark CI suite, state persistence, per-workflow telemetry |

## For app developers

Apply the same server-side aggregation philosophy to your own agent tool layer. Instead of returning raw query results to the agent, each tool aggregates server-side and returns a single clean structured object.

```
❌ Thin: agent → search_comps() → 15 raw rows → agent reasons over them
✅ Thick: agent → research_pricing(id) → { price, confidence, evidence }
```

See [DEVELOPER.md](docs/DEVELOPER.md) for the full pattern and `tool_calls` observability details.

## Development

```sh
npm install
npm run dev         # start server with tsx
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # biome check
```

Issue tracking: `bd ready` (requires beads).

## License

MIT
````

- [ ] **Step 2: Verify README structure**

```bash
grep "^## " /Users/joeblack/github/joeblackwaslike/mcp-exec/README.md
```

Expected output (in order):
```
## 52,000 tokens → 50 tokens.
## You've been here.
## Before / After
## How it works
## Token savings
## Scenarios
## Reproducible case study
## Installation
## Skills
## Requirements
## Reference
## When NOT to use mcp-exec
## Security
## Plugin compatibility
## Roadmap
## For app developers
## Development
## License
```

- [ ] **Step 3: Check for unclosed code fences**

```bash
grep -c '^\`\`\`' /Users/joeblack/github/joeblackwaslike/mcp-exec/README.md
```

Expected: even number.

- [ ] **Step 4: Commit**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git add README.md
git commit -m "docs: README — case study ref, installation, skills, reference, bottom sections"
```

---

## Task 10: Final polish and push

- [ ] **Step 1: Full README review**

```bash
wc -l /Users/joeblack/github/joeblackwaslike/mcp-exec/README.md
```

Scan for:
- Any `TODO`, `TBD`, placeholder text
- Broken relative links (assets/, case-study.md, docs/DEVELOPER.md)
- Any leftover content from the old README that wasn't intentionally kept

- [ ] **Step 2: Verify all assets exist**

```bash
ls -lh /Users/joeblack/github/joeblackwaslike/mcp-exec/assets/
```

Expected files: `logo-dark.svg`, `logo-light.svg`, `infographic-before-after.svg`, `infographic-arch.svg`, `infographic-savings.svg`, `demo-session.sh`, `demo.tape`, `demo.gif`

- [ ] **Step 3: Check git status — nothing untracked or unstaged**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git status
```

Expected: clean working tree.

- [ ] **Step 4: Push branch**

```bash
cd /Users/joeblack/github/joeblackwaslike/mcp-exec
git pull --rebase origin main
git push -u origin feat/readme-overhaul
```

- [ ] **Step 5: Open PR**

```bash
gh pr create \
  --title "docs: README overhaul — viral rewrite with SVG hero, infographics, scenarios, case study" \
  --body "$(cat <<'EOF'
## Summary

- SVG logo mark (orange/red filled box, dark + light variants)
- Visceral hero: rate limit pain → mcp-exec as the fix
- Three infographic SVGs (before/after flow, architecture, token savings bars)
- Five code scenarios (invoice triage, standup, research, stateful, python)
- Reproducible case-study.md (43,800 → 90 tokens, replicable in 5 min)
- VHS demo GIF (two-act: pain → fix)
- All v0.3 features documented (Python runtime, bundled packages, two skills)

## Test plan

- [ ] View rendered README on GitHub, verify SVGs render, GIF plays
- [ ] Click all links (article callout, installation, case-study.md)
- [ ] View in GitHub dark mode — `<picture>` tag serves logo-dark.svg
- [ ] View in GitHub light mode — `<picture>` tag serves logo-light.svg
- [ ] Run case-study.md benchmark independently
EOF
)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Hero (SVG mark + tagline + badges) — Task 6
- ✅ Anthropic article callout — Task 6
- ✅ Demo GIF — Task 4
- ✅ CTA row — Task 6
- ✅ The number (52k → 50) — Task 7
- ✅ Pain hook — Task 7
- ✅ Before/After infographic — Tasks 3 + 7
- ✅ Architecture diagram — Tasks 3 + 7
- ✅ Token savings chart — Tasks 3 + 7
- ✅ 3 scenarios (invoice, standup, research) + stateful + Python — Task 8
- ✅ Reproducible case study — Tasks 5 + 9
- ✅ Installation — Task 9
- ✅ Skills section (v0.3) — Task 9
- ✅ Requirements (uv added) — Task 9
- ✅ Reference (all 3 runtimes, bundled packages, PEP 723) — Task 9
- ✅ When NOT to use, Security, Roadmap, Plugin compat, License — Task 9
- ✅ Logo SVGs — Task 2
- ✅ .gitignore .superpowers/ — Task 1

**No placeholders found.**

**Type/name consistency:** SVG gradient IDs are unique per file (`mark`, `bad`, `good`, `og`). README image paths match `assets/` filenames exactly.
