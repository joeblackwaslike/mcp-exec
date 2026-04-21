# Python MCP SDK Reference for mcp-exec

> Pre-processed reference for writing Python code inside `exec()` calls.
> Python runs stateless — no session state persists between calls.
> MCP tool calling is not available from Python (see mcp-exec-ij3).

---

## Runtime environment

- **Python version:** 3.12.x (via uv)
- **Isolation:** `uv run --isolated` — no access to the user's installed packages
- **State:** stateless — each `exec()` call is a fresh process
- **Result channel:** stdout only — `print()` is the equivalent of `return` in Node

---

## Declaring dependencies with PEP 723

Add an inline script header to declare dependencies and Python version. `uv` parses
this natively and installs into a throwaway environment:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas>=2.0", "httpx"]
# ///

import pandas as pd
import httpx

# your code here
print("result")
```

**Always include this header when using third-party packages.** Without it, only the
standard library is available.

uv caches resolved environments by dependency hash — first use of a dependency set is
slow (~2-10s depending on packages); subsequent calls with the same deps are fast (<100ms overhead).

---

## Curated package set

Known-working packages for common tasks. Declare in PEP 723 header:

| Package | Use case | Import |
|---|---|---|
| `httpx` | HTTP requests (sync + async) | `import httpx` |
| `pandas` | Data analysis and transformation | `import pandas as pd` |
| `pydantic` | Structured output validation | `from pydantic import BaseModel` |
| `rich` | Readable terminal output | `from rich import print` |
| `beautifulsoup4` | HTML/XML parsing | `from bs4 import BeautifulSoup` |
| `openpyxl` | Excel read/write | `import openpyxl` |
| `python-dotenv` | Env var loading | `from dotenv import load_dotenv` |

---

## stdout as the return channel

Only stdout enters the context window. Everything you want Claude to see must be printed:

```python
import json, sys

data = {"status": "ok", "count": 42}
print(json.dumps(data))   # this reaches Claude
```

`stderr` (tracebacks, warnings) is captured separately and appears in the `stderr` field
of the exec result — visible for debugging but not in `result`.

---

## Receiving data from a Node exec

Python has no access to Node session state. Thread data by writing it to a temp file in
Node and reading it in Python, or pass small payloads via env vars.

**Temp file pattern (for large payloads):**

```typescript
// exec 1 (node) — write data to a temp file
import { writeFileSync } from 'fs';
const data = await fetchLargeDataset();
writeFileSync('/tmp/mcp-exec-data.json', JSON.stringify(data));
return '/tmp/mcp-exec-data.json';
```

```python
# exec 2 (python) — read from the temp file
# /// script
# dependencies = ["pandas"]
# ///
import pandas as pd, json

with open('/tmp/mcp-exec-data.json') as f:
    data = json.load(f)

df = pd.DataFrame(data)
print(df.describe().to_json())
```

**Env var pattern (for small payloads):**

```typescript
// exec 1 (node)
const value = await getThing();
return value; // pass as env var in exec 2
```

```typescript
// orchestrating code — pass node result as env var
// Note: env vars are strings — use JSON.stringify for objects
exec({ runtime: 'python', code: `...`, env: { INPUT: JSON.stringify(nodeResult.result) } })
```

```python
# exec 2 (python)
import os
value = os.environ['INPUT']
print(value.upper())
```

---

## Error handling

A non-zero exit code surfaces as `exitCode` in the exec result. The Python traceback
appears in `stderr`. Claude can read `stderr` and retry with corrected code.

```python
# raise naturally — mcp-exec captures the traceback in stderr
df = pd.read_csv('/tmp/missing.csv')   # FileNotFoundError → exitCode=1, traceback in stderr
```

---

## Limitations

- **No MCP tool calls** — Python cannot call `__mcpClients`. Use Node for MCP tool
  orchestration, then thread results to Python for processing. Tracked: `mcp-exec-ij3`
- **No session state** — `globalThis` is Node-only. Each Python exec is a fresh process.
  Tracked: `mcp-exec-1sb`
- **No stdin** — the Python process stdin is not connected. Use files or env vars to
  pass data in.

---

## exec result shape

```python
# mcp-exec returns to Claude after exec({ runtime: 'python', ... }):
{
  "result": "<everything printed to stdout>",
  "tool_calls": []   # always empty for Python
}

# On runtime error (non-zero exit):
{
  "result": "",      # stdout up to the error point
  "tool_calls": []
}
# stderr contains the traceback — not returned to Claude; check exitCode or print errors to stdout
```
