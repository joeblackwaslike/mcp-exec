# Test & Build Commands

**Testing**:
```bash
npm test              # run all tests once
npm run test:watch   # watch mode for TDD
```

**Building**:
```bash
npm run build        # compile TypeScript to dist/
```

**Development**:
```bash
npm run dev          # run src/server.ts with tsx (no build required)
```

**Session Completion** (per CLAUDE.md):
1. Run tests: `npm test`
2. Run build: `npm run build`
3. Commit: `git add ...` then `git commit -m "..."`
4. Push: `git pull --rebase && git push`
