export const meta = {
  name: 'e2e-hardening',
  description: '10 Sonnet agents harden the full stack in parallel: backend auth, insights, two router clusters, four frontend page clusters, shell, shared components.',
  phases: [
    { title: 'Harden' },
    { title: 'Validate' },
    { title: 'Fix' },
  ],
}

const REPO = '/Users/ayux/Coding/base'

const SHARED_HARDENING_DIRECTIVES = `
=================================================================================
HARDENING CHECKLIST (apply every item to every file in your scope)
=================================================================================

BACKEND (tRPC routers, models, libs):
  H1  Input validation: every procedure's Zod schema must reject obvious bad
      input (negative numbers where positive required, empty strings, max
      lengths on user-facing strings, string array dedup where relevant).
  H2  Auth: every protectedProcedure must use requireUserId(ctx). Public
      procedures: justify why (otherwise upgrade to protected).
  H3  Error handling: wrap every external call (Gemini, NewsAPI, Carbon
      Interface, fetch, axios) in try/catch and re-throw as TRPCError with
      meaningful code (BAD_GATEWAY for upstream failures, INTERNAL_SERVER_ERROR
      for parse failures, BAD_REQUEST for validation issues, NOT_FOUND for
      missing docs).
  H4  Defensive Mongoose: any findById/findOne must null-check before use.
      Any update/delete must verify the doc belongs to ctx.user.
  H5  No floating promises. Every async call awaited or .catch()ed.
  H6  Imports: NodeNext requires .js extensions on relative imports — verify.
      Remove unused imports. Sort: external → internal → models → schemas
      → trpc helpers.
  H7  Magic numbers extracted to named constants at the top of the file
      when they appear more than once or carry non-obvious meaning.
  H8  Output shape: queries that return documents should pluck only the
      fields the frontend needs (don't leak internal fields). For now,
      keep existing shapes; do NOT change procedure outputs (frontend
      depends on them).
  H9  Do NOT change procedure input or output schemas — only internal
      hardening. The frontend pages are wired to the current shapes.

FRONTEND (React pages, components):
  V1  No layout shift. Loading states use skeletons matching final
      dimensions. Use framer-motion AnimatePresence for transitions
      (already a dep).
  V2  Empty states are warm: lucide icon (already a dep) + 1-line
      direction + CTA where relevant.
  V3  Error states: every useQuery and useMutation has visible error
      handling. Mutations toast on error (react-toastify is a dep).
      Queries that fail show inline retry with onClick={query.refetch}.
  V4  Memory safety: every setInterval/setTimeout/requestAnimationFrame/
      MediaStream/EventSource/WebSocket created in a useEffect MUST be
      cleaned up in the return. Audit your files for this. Any state
      setter called from an async callback must check a mounted ref
      OR be safely idempotent.
  V5  Accessibility: every button/link has an accessible name (text or
      aria-label). Form inputs have associated <label htmlFor>. Modal/
      drawer open state focus-traps where possible. Status/live regions
      use aria-live="polite". Focus rings preserved (don't blanket-
      remove outline).
  V6  Keyboard: forms submit on Enter, dialogs close on Escape, primary
      CTA can be triggered with Space when focused.
  V7  Number/date formatting: extract a tiny helper for percent, count,
      bytes, currency, and date display. Use it consistently within
      your scope. Don't introduce a new dependency.
  V8  Mobile: every page must be usable at 375px width. Test mental
      model: grid → stack at <sm breakpoint. Sticky elements should
      not overlap content on mobile.
  V9  Performance: useMemo / useCallback for heavy derived values and
      stable callbacks passed to memoized children. React.memo a
      component if it's rendered in a long list with stable props.
      Don't over-memoize trivial things.
  V10 Animation budget: 150-250ms per transition. No bouncy springs on
      mission-critical buttons. Reduced-motion respected via
      prefers-reduced-motion (a CSS media query around your @keyframes
      is fine; framer-motion has useReducedMotion).
  V11 No forbidden words in UI copy: demo, showcase, hackathon, hack,
      prototype, MVP (as a standalone word). Treat this as production.
  V12 Strict TypeScript. No new \`any\`. Cast Mongoose-shaped tRPC
      returns through \`unknown\` first if needed (\`as unknown as T\`).

CREATIVE UI POLISH (apply 2-3 per page/component scope):
  C1  Glow / soft-shadow on the primary active state.
  C2  Subtle gradient backgrounds on hero/feature cards (blue → emerald
      where appropriate).
  C3  Pulse animation on critical metrics when their value increases.
  C4  Color-coded severity gradients (emerald → amber → red).
  C5  Micro-interactions: lift on hover, tap on click, fade-slide on
      mount.
  C6  Animated numbers with the existing CountUp component
      (../../components/CountUp).
  C7  Use lucide-react icons consistently — no inline SVG where a
      lucide icon already exists for the concept.
  C8  Consistent rounded-2xl + border-slate-200 + shadow-sm card style.
=================================================================================
`

const AGENTS = [
  {
    id: 'A1',
    label: 'backend-auth-security',
    title: 'Backend: auth, security, legacy REST',
    owns: [
      'backend/src/routers/auth.ts',
      'backend/src/context.ts',
      'backend/src/middleware/auth.ts',
      'backend/src/legacy/auth.ts',
      'backend/src/legacy/compliance.ts',
      'backend/src/config/passport.ts',
      'backend/src/config/multer.ts',
      'backend/src/schemas/user.ts',
      'backend/src/models/User.ts',
    ],
    extra: `
  - Audit JWT verification: ensure expiry honored, ensure secret presence
    checked, ensure no token leak in error messages.
  - Audit Google OAuth callback: validate user shape before signing JWT.
  - Audit multer upload routes: file-size limits, MIME-type allowlist,
    GCS upload error handling.
  - Add rate-limiting hooks comments where appropriate (no need to wire
    a new dependency — note in code where express-rate-limit would go).
    The express-rate-limit dep is already in package.json.
`,
  },
  {
    id: 'A2',
    label: 'backend-insights-shared',
    title: 'Backend: insights + lib + db',
    owns: [
      'backend/src/routers/insights.ts',
      'backend/src/routers/_app.ts',
      'backend/src/lib/auth.ts',
      'backend/src/lib/db.ts',
      'backend/src/lib/routeConstants.ts',
      'backend/src/utils/geocode.ts',
      'backend/src/index.ts',
      'backend/src/trpc.ts',
    ],
    extra: `
  - The insights router aggregates across 6+ models. Defensive coding:
    every model query wrapped to return neutral/zero on failure.
  - Trust score arithmetic: clamp every input to [0,100], handle missing
    data with the documented neutral=70 weight=0.5 rule.
  - Add structured logger comments (use console.warn/error consistently)
    for production observability.
  - db.ts: surface MongoDB connection errors clearly (do not swallow).
  - geocode.ts: timeout + retry policy on the upstream API.
  - index.ts: 404 fallback, JSON error formatter middleware so unknown
    paths don't crash the response cycle.
`,
  },
  {
    id: 'A3',
    label: 'backend-verification-routers',
    title: 'Backend: 5 verification routers',
    owns: [
      'backend/src/routers/boxCount.ts',
      'backend/src/routers/shipmentDiff.ts',
      'backend/src/routers/rfid.ts',
      'backend/src/routers/weightCheck.ts',
      'backend/src/routers/anomaly.ts',
      'backend/src/models/BoxCountResult.ts',
      'backend/src/models/ShipmentDiff.ts',
      'backend/src/models/RfidScanResult.ts',
      'backend/src/models/WeightCheck.ts',
      'backend/src/models/AnomalyReport.ts',
    ],
    extra: `
  - Gemini call hardening across all 5 routers: missing-key check,
    try/catch on generateContent, try/catch on JSON.parse, slice raw
    text in error messages to 240 chars max to avoid log explosion.
  - Image base64 length sanity check (refuse >10 MB ≈ 13.4M base64 chars).
  - Numeric clamping on AI-returned scores (0-100, 0-1 for confidence,
    0-100% for mismatchPct).
  - Auto-anomaly emission preserved (do not regress the cross-feature
    linkage Agent A in the previous sweep added).
  - Audit writes preserved: every verification mutation continues to
    write an AuditEvent (failure-safe).
  - Mongoose models: ensure indices on userId, draftId, createdAt where
    used by listing queries.
`,
  },
  {
    id: 'A4',
    label: 'backend-ops-routers',
    title: 'Backend: 5 operations & audit routers',
    owns: [
      'backend/src/routers/loadMatch.ts',
      'backend/src/routers/tracking.ts',
      'backend/src/routers/fraud.ts',
      'backend/src/routers/trucks.ts',
      'backend/src/routers/audit.ts',
      'backend/src/routers/inventory.ts',
      'backend/src/routers/compliance.ts',
      'backend/src/routers/logistics.ts',
      'backend/src/models/LoadOffer.ts',
      'backend/src/models/TrackingPing.ts',
      'backend/src/models/Truck.ts',
      'backend/src/models/AuditEvent.ts',
      'backend/src/models/Draft.ts',
      'backend/src/models/SaveRoute.ts',
      'backend/src/models/ComplianceRecord.ts',
      'backend/src/models/NewsHistory.ts',
      'backend/src/models/ProductAnalysis.ts',
    ],
    extra: `
  - loadMatch.findMatches: defensive null check on the offer document
    + clear NOT_FOUND if missing. Cap the result array to 50.
  - tracking.ping: validate that lat/lng are in valid ranges
    (-90..90, -180..180). Speed clamped to <=200 km/h to reject
    impossible values.
  - fraud.summary: every model query try/catch so an empty collection
    or model load issue returns zeros instead of crashing.
  - trucks.remove: ownership check (truck.userId === ctx.user) before
    deletion.
  - audit.append: cap payload size (JSON-stringify length <= 4 KB)
    to prevent log bloat.
  - inventory/compliance/logistics: review for unhandled rejections,
    bare throws, and missing input validation. These routers existed
    before the sweep — they may be under-hardened.
`,
  },
  {
    id: 'F1',
    label: 'frontend-verification-pages',
    title: 'Frontend: 4 verification pages',
    owns: [
      'frontend/src/pages/box-count/**',
      'frontend/src/pages/shipment-diff/**',
      'frontend/src/pages/rfid-verification/**',
      'frontend/src/pages/weight-check/**',
    ],
    extra: `
  - box-count: tighten the camera lifecycle — stopCamera must run on
    unmount even mid-session. The frame loop timer + duration timer
    must be cleared on stop AND on unmount. Add a "mounted" ref pattern
    if any setState fires from a fetch callback.
  - shipment-diff: the two-up upload + scan animation must reset
    cleanly between runs. Handle the case where one image is missing.
  - rfid-verification: the simulated tag-stream terminal must clean up
    its timers on unmount. Show a clear empty state when no manifest
    tags are entered. Trim/dedup manifest tags before submit.
  - weight-check: the simulated sensor stream chart must cancel its
    requestAnimationFrame on unmount. Negative weights rejected at
    the UI layer too (not just zod).
  - All four pages: keyboard support (Enter submits form, Escape
    cancels in-progress streams where applicable).
`,
  },
  {
    id: 'F2',
    label: 'frontend-intelligence-pages',
    title: 'Frontend: 4 intelligence pages',
    owns: [
      'frontend/src/pages/anomaly-detection/**',
      'frontend/src/pages/fraud-dashboard/**',
      'frontend/src/pages/audit-log/**',
      'frontend/src/pages/trust-center/**',
    ],
    extra: `
  - anomaly-detection: the drifting sparklines on input fields must
    clean up rAF on unmount. Radar chart resilient to undefined values.
  - fraud-dashboard: pulse-on-increase needs a previous-value ref to
    detect deltas. The 4s/6s polling must respect document visibility
    (use document.hidden gate or rely on react-query's default
    refetchOnWindowFocus).
  - audit-log: hash chain visual is purely visual — short hex from
    djb2 on (id+ts+eventType). Copy-on-click must use the Clipboard API
    with a fallback document.execCommand catch. Toast confirmation.
  - trust-center: draft picker is the only required input. While no
    draft is selected, render an instructional empty state with skeleton
    placeholders for the future panels. Loading skeleton matches loaded
    dimensions (no layout shift on data arrival).
  - All four pages: list-virtualization not required, but cap rendered
    list lengths to 200 with a "Show more" affordance if longer.
`,
  },
  {
    id: 'F3',
    label: 'frontend-operations-pages',
    title: 'Frontend: 3 operations pages',
    owns: [
      'frontend/src/pages/load-aggregation/**',
      'frontend/src/pages/live-tracking/**',
      'frontend/src/pages/truck-registry/**',
    ],
    extra: `
  - load-aggregation: corridor scan SVG arc must handle origin ===
    destination gracefully. Match list staggers on mount; re-runs use
    AnimatePresence to fade old matches out and new ones in.
  - live-tracking: Google Maps requires VITE_GOOGLE_MAPS_KEY. If
    missing, render a static fallback (canvas with cities labeled +
    line). The "Advance" button must rate-limit on the client (1
    click per second) so users can't spam pings.
  - truck-registry: capacity ring stable on re-render (compute deterministic
    fill from \`(plate hash) % 100\` if no real usage data, so it doesn't
    flicker). Confirm dialog before remove.
  - All three pages: forms reset cleanly after successful submission.
`,
  },
  {
    id: 'F4',
    label: 'frontend-legacy-pages',
    title: 'Frontend: legacy pages (auth, compliance, inventory, route, news, profile, docs)',
    owns: [
      'frontend/src/pages/auth/**',
      'frontend/src/pages/compliance-check/**',
      'frontend/src/pages/inventory-management/**',
      'frontend/src/pages/route-optimization/**',
      'frontend/src/pages/news/**',
      'frontend/src/pages/profile/**',
      'frontend/src/pages/documentation/**',
    ],
    extra: `
  - These pages predate the sweep and may have pre-existing rough
    edges. Focus: validation on all forms, error states on every
    fetch, skeletons replacing spinners on data-loading sections,
    no layout shift on data arrival.
  - auth: login/createAccount validate before submit, show password
    visibility toggle, redirect cleanly post-login (preserve any
    ?next param). Google login button has accessible label.
  - compliance-check: multi-step wizard must not lose state on
    accidental tab switch (persist to sessionStorage by step). CSV
    upload UX: clear error messaging on bad rows.
  - inventory-management: tab switches don't lose scroll position.
    Map view falls back gracefully if maps API key missing.
  - route-optimization: long forms get progress affordance. Carbon
    footprint result animates in.
  - news: news list paginated client-side if more than 30 items.
    Card images have alt text.
  - profile: forms surface validation per-field.
  - documentation: scroll-anchored TOC if present.
`,
  },
  {
    id: 'F5',
    label: 'frontend-shell',
    title: 'Frontend: shell (App, Header, Dashboard, breadcrumb, drawer)',
    owns: [
      'frontend/src/App.tsx',
      'frontend/src/main.tsx',
      'frontend/src/components/Header.tsx',
      'frontend/src/components/Breadcrumb.tsx',
      'frontend/src/components/ChatbotDrawer.tsx',
      'frontend/src/components/ProtectedRoute.tsx',
      'frontend/src/components/ThemeToggle.tsx',
      'frontend/src/pages/dashboard/**',
      'frontend/src/context/**',
      'frontend/src/lib/trpc.ts',
      'frontend/src/lib/trpcProvider.tsx',
    ],
    extra: `
  - Add a global ErrorBoundary at App.tsx root with a graceful fallback
    UI. Caught errors render a Lucide AlertTriangle + 1-line message +
    "Reload" button. Don't expose stack to the user.
  - Header breadcrumb: ensure all known feature routes are mapped.
    Unknown routes degrade to "Home › Page".
  - Dashboard hero: gauge animation triggers only on score change
    (avoid re-animating on every refetch).
  - Dashboard skeletons must match exact final dimensions.
  - ChatbotDrawer: ensure focus trap when open, Escape closes,
    aria-modal=true. Backdrop click closes.
  - ProtectedRoute loading skeleton matches a typical page layout
    (Header + content placeholder) so navigation doesn't flash blank.
  - trpcProvider: queryClient defaults — staleTime: 5_000 for queries,
    retry: 1 (don't hammer the backend on failure).
  - main.tsx: any uncaught render error renders the ErrorBoundary
    fallback instead of a blank page.
`,
  },
  {
    id: 'F6',
    label: 'frontend-shared-components',
    title: 'Frontend: shared components + lib polish',
    owns: [
      'frontend/src/components/CountUp.tsx',
      'frontend/src/components/InsightsRail.tsx',
      'frontend/src/components/DraftPicker.tsx',
      'frontend/src/components/TrustGauge.tsx',
      'frontend/src/components/OperationsTicker.tsx',
      'frontend/src/components/FeatureGroupGrid.tsx',
      'frontend/src/components/Toast.tsx',
      'frontend/src/components/skeletons/**',
      'frontend/src/lib/insights.ts',
      'frontend/src/constants/**',
    ],
    extra: `
  - CountUp: respect prefers-reduced-motion (snap to value instantly
    when set). Cancel rAF on unmount. Handle negative deltas. Default
    duration prop = 400ms.
  - InsightsRail: cap rendered items, virtualize NOT required, but
    show a "view all" affordance if >30 items. Skeleton when loading.
    Item rows have accessible time relative + absolute (title attr).
  - DraftPicker: dropdown closes on Escape, click-outside, and item
    select. Keyboard navigable (Arrow up/down to move selection).
    Selected draft persists in sessionStorage so it survives page
    navigation across the verification flow.
  - TrustGauge: SVG circular gauge — smoothly tween from previous
    value to next over 600ms. Color from emerald → amber → red as
    the score decreases. Accessible: role="meter" with aria-valuemin,
    aria-valuemax, aria-valuenow.
  - OperationsTicker: CSS-only scroll. Pause-on-hover. Pause when
    document hidden. Tick items have aria-live="off" (scrolling
    content is not for screen readers; provide an "Activity feed"
    link to a static list nearby).
  - FeatureGroupGrid: cards keyboard navigable (each is a real Link
    with focus ring). Reduce-motion respected.
  - Toast: ensure no duplicate toasts within 1 second window for
    identical messages (debounce).
  - skeletons: provide variants — Card, Row, Hero — all with the
    same pulse animation to look unified.
  - lib/insights.ts: score → color, score → verdict label, severity
    → tailwind class helpers. Make these pure functions, exported.
`,
  },
]

const FILE_RULES = `
=================================================================================
FILE OWNERSHIP RULES (STRICT — violating these breaks the parallel run)
=================================================================================

YOU may ONLY write to files listed in YOUR "owns" list. Do not touch:
  - Any file owned by another agent (their list is below for reference).
  - Any new shared component (if you need a helper, inline it in your
    file or extend an existing shared component within your ownership).

YOU MAY READ any file in the repo for context.

If you find a bug in a file outside your scope, report it at the END of
your response under "## Out-of-scope findings" — DO NOT fix it.

If a file in your scope imports something that doesn't exist, do not
create the missing file. Add a TODO comment naming the expected import
and leave it. Document it in "Out-of-scope findings".

After editing, run from the appropriate directory:
  - Backend agents: \`cd ${REPO}/backend && npx tsc --noEmit\`
  - Frontend agents: \`cd ${REPO}/frontend && npx tsc --noEmit\`
Report the result. If errors appear in files you DON'T own, list them
as "Out-of-scope findings" and leave them — the fixer will handle.

When done, respond with:
  ## Files modified
  (one absolute path per line)

  ## Hardening summary
  (3-8 lines describing what you tightened, no marketing language)

  ## Out-of-scope findings
  (issues you saw in files you can't edit, or "(none)")

  ## tsc result
  one line: "TSC: ok" or first 5 error lines
`

function buildAgentPrompt(a, allAgents) {
  const others = allAgents
    .filter((x) => x.id !== a.id)
    .map((x) => `  ${x.id} (${x.label}): ${x.owns.map((o) => '    - ' + o).join('\n')}`)
    .join('\n')
  return `You are Agent ${a.id} — ${a.title}.

REPO ROOT: ${REPO}

=================================================================================
YOUR EXCLUSIVE FILE OWNERSHIP
=================================================================================
${a.owns.map((o) => '  - ' + o).join('\n')}

=================================================================================
TASK
=================================================================================
Apply the hardening checklist below to every file in your scope.

EXTRA DIRECTIVES SPECIFIC TO YOUR SCOPE:
${a.extra}

${SHARED_HARDENING_DIRECTIVES}

${FILE_RULES}

=================================================================================
OTHER AGENTS' OWNERSHIP (read-only awareness; DO NOT touch their files)
=================================================================================
${others}
`
}

const VALIDATOR_PROMPT = `Validate the hardening sweep.

Run (each with 5min timeout):
  1. \`cd ${REPO}/backend && npx tsc --noEmit\`
  2. \`cd ${REPO}/frontend && npx tsc --noEmit\`
  3. \`cd ${REPO}/frontend && npm run lint\`
  4. \`cd ${REPO}/frontend && npx vite build\`

Also scan UI source for forbidden words:
  \`cd ${REPO}/frontend/src && grep -rni -E '\\b(demo|showcase|hackathon|prototype|hack)\\b' . | grep -v node_modules | grep -v dist\`

For each command: exit 0 → ok=true; else capture up to 30 error lines.
Return JSON via StructuredOutput.`

const VALIDATOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['backendTsc', 'frontendTsc', 'lint', 'build', 'forbiddenWordHits'],
  properties: {
    backendTsc: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'errors'],
      properties: { ok: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } },
    },
    frontendTsc: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'errors'],
      properties: { ok: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } },
    },
    lint: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'errors'],
      properties: { ok: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } },
    },
    build: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'errors'],
      properties: { ok: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } },
    },
    forbiddenWordHits: { type: 'array', items: { type: 'string' } },
  },
}

function buildFixerPrompt(r) {
  return `Final fixer. The 10-agent hardening sweep finished. Some validation steps reported issues.

REPO ROOT: ${REPO}

BACKEND TSC ERRORS (${r.backendTsc.errors.length}):
${r.backendTsc.errors.slice(0, 40).join('\n') || '(none)'}

FRONTEND TSC ERRORS (${r.frontendTsc.errors.length}):
${r.frontendTsc.errors.slice(0, 40).join('\n') || '(none)'}

LINT ERRORS (${r.lint.errors.length}):
${r.lint.errors.slice(0, 40).join('\n') || '(none)'}

BUILD ERRORS (${r.build.errors.length}):
${r.build.errors.slice(0, 40).join('\n') || '(none)'}

FORBIDDEN WORDS in UI (${r.forbiddenWordHits.length}):
${r.forbiddenWordHits.slice(0, 40).join('\n') || '(none)'}

RULES:
- Only edit files with errors / forbidden hits.
- No @ts-ignore unless strictly necessary.
- Preserve all behavior; DO NOT delete features to silence errors.
- Backend imports must end in .js.
- For forbidden words: replace with neutral production language.

After fixing, re-run all four commands and report:
  - Files edited
  - "BACKEND_TSC_FINAL", "FRONTEND_TSC_FINAL", "LINT_FINAL", "BUILD_FINAL"
  - Remaining forbidden hits
`
}

// ────────────────────────────────────────────────────────────────────────────

phase('Harden')
const results = await parallel(
  AGENTS.map((a) => () =>
    agent(buildAgentPrompt(a, AGENTS), {
      label: a.label,
      phase: 'Harden',
      model: 'sonnet',
    })
  )
)

log(`Hardening phase done: ${results.filter(Boolean).length}/${AGENTS.length} agents reported`)

phase('Validate')
const validation = await agent(VALIDATOR_PROMPT, {
  label: 'validator',
  phase: 'Validate',
  model: 'sonnet',
  schema: VALIDATOR_SCHEMA,
})

let fix = null
const needsFix =
  !validation.backendTsc.ok ||
  !validation.frontendTsc.ok ||
  !validation.lint.ok ||
  !validation.build.ok ||
  validation.forbiddenWordHits.length > 0

if (needsFix) {
  phase('Fix')
  fix = await agent(buildFixerPrompt(validation), {
    label: 'fixer',
    phase: 'Fix',
    model: 'sonnet',
  })
}

return {
  agents: AGENTS.map((a) => ({ id: a.id, label: a.label })),
  results,
  validation,
  fix,
}
