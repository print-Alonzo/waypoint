# Waypoint

A single-city Metro Manila trip-itinerary optimizer: you pick the places, Waypoint sequences only
the **order** of your day and shows its work (flags anything closed/unreachable instead of dropping
it). Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4, no backend — scheduling runs
client-side over static JSON, deploys to Vercel. The app lives in `web/`.

Key commands (run from `web/`):
```bash
npm install
npm run dev         # http://localhost:3000
npm run test        # unit + component tests (Vitest)
npm run build       # production build (also type-checks)
npm run gen:matrix  # regenerate data/<city>/transit-matrix.json from pois.json
npm run lint
```

For real detail, read these rather than re-deriving from source:
- [`web/README.md`](web/README.md) — stack, routes, project layout, feature flags, adding places
- [`web/DESIGN.md`](web/DESIGN.md) — design tokens, component patterns, accessibility, print rules
- [`docs/designs/waypoint-mvp.md`](docs/designs/waypoint-mvp.md) — original approved spec (historical)
- [`TODOS.md`](TODOS.md) — deferred / future work

`web/CLAUDE.md` imports `web/AGENTS.md`, which carries a Next.js-16-breaking-changes warning for
in-app work — read it before writing code under `web/`.

# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
