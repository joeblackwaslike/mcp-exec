/**
 * mcp-exec plugin for OpenCode.ai
 *
 * Registers the skills directory so OpenCode discovers mcp-exec skills,
 * and injects the using-mcp-exec bootstrap into the first user message.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../../skills');

const extractBody = (content) => {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
};

const DOCS_URL = 'https://joeblackwaslike.github.io/mcp-exec/';

const getBootstrap = () => {
  const skillPath = path.join(skillsDir, 'using-mcp-exec', 'SKILL.md');
  if (!fs.existsSync(skillPath)) return null;
  const body = extractBody(fs.readFileSync(skillPath, 'utf8'));

  return `<IMPORTANT>
You have access to mcp-exec tools: \`tools(query)\` (search MCP catalog) and \`exec(code, runtime)\` (sandboxed Node/Bash/Python — only final output returned).

${body}

**Tool mapping for OpenCode:** Use your native file/shell tools inside exec(). The \`skill\` tool loads mcp-exec skills by name.

**Docs:** ${DOCS_URL} — Guide, Manual, Developer, Reference
</IMPORTANT>`;
};

export const McpExecPlugin = async (_context) => {
  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      const bootstrap = getBootstrap();
      if (!bootstrap || !output.messages.length) return;
      const firstUser = output.messages.find((m) => m.info.role === 'user');
      if (!firstUser?.parts.length) return;
      if (firstUser.parts.some((p) => p.type === 'text' && p.text.includes('mcp-exec tools')))
        return;
      const ref = firstUser.parts[0];
      firstUser.parts.unshift({ ...ref, type: 'text', text: bootstrap });
    },
  };
};
