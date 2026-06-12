export const meta = {
  name: 'e2e-correctness',
  description: '5 Opus agents own vertical slices end-to-end: verification, intelligence, operations, legacy/auth, shell. Each traces every flow, fixes runtime bugs, ensures the click-through works.',
  phases: [
    { title: 'Trace & fix' },
    { title: 'Validate' },
    { title: 'Fix' },
  ],
}

const REPO = '/Users/ayux/Coding/base'

const COMMON_RULES = `
=================================================================================
END-TO-END CORRECTNESS DOCTRINE — read once, apply everywhere
=================================================================================

Your job is NOT to add features. Your job is to make every existing flow in
your scope actually work click-by-click without bugs. Be ruthless.

For every page in your scope:

T1  TRACE EACH FORM SUBMIT.
    - Read the form's onSubmit handler.
    - Walk the tRPC mutation call.
    - Open the matching router procedure. Verify input shapes match.
    - Verify the procedure persists what the UI claims it persisted.
    - Verify the mutation's onSuccess updates UI state correctly.
    - Verify the mutation's onError surfaces a message to the user.

T2  TRACE EACH QUERY.
    - Walk where useQuery is consumed. Verify the consumer handles
      isLoading, isError, !data, empty array, and populated array.
    - Verify the page never renders \`data.something\` before checking
      \`data\` is defined.
    - Verify .refetch() is wired where the UI implies a refresh.

T3  STATE MACHINE AUDIT.
    - List every \`useState\` on the page. For each, ask: can this state
      get into an inconsistent combination with other states?
      (e.g., loading=true AND error=set; mode=live AND streamRef=null.)
    - Add invariants where needed.

T4  EFFECT CLEANUP.
    - Every \`setInterval\`, \`setTimeout\`, \`requestAnimationFrame\`,
      \`MediaStream\`, \`AbortController\`, \`addEventListener\` created in
      a useEffect must be torn down in the return.
    - Setters called from async callbacks: gate by a mounted ref OR
      cancel the upstream call on unmount.

T5  RACE CONDITIONS.
    - If two mutations can fire concurrently from the same page, ensure
      \`mutation.isPending\` disables the trigger.
    - Polling queries: ensure no overlapping fetches (react-query's
      keepPreviousData / staleTime handles most cases — verify).

T6  EMPTY / ERROR / LOADING STATES.
    - Every async section MUST render meaningful content for each of:
      loading, error, empty, populated. No "[object Object]", no blank,
      no React fragment surprise.

T7  TYPE TRUTH.
    - The interface a page declares for a tRPC response must MATCH
      the shape the router actually returns. Walk both sides.
    - Mongoose ObjectId vs string: cast through \`unknown\` where needed
      (project convention), but only after verifying field-by-field.

T8  CROSS-FEATURE EXPECTATIONS.
    - If your code is expected to emit an AnomalyReport (per the auto-
      emission contract: box-count mismatch >20%, shipment-diff risk >70,
      weight deviation >15%, RFID match <80%), verify the write actually
      happens and is failure-safe.
    - If your code is expected to write an AuditEvent on every
      verification mutation, verify it.
    - If your code is consumed by insights.recentActivity or
      insights.draftBundle or insights.shipmentTrustScore, verify the
      shape matches what those procedures expect.

T9  AUTH POSTURE.
    - protectedProcedure must use \`requireUserId(ctx)\`.
    - Mongoose updates/deletes must scope by ctx user where ownership
      matters.

T10 SCREEN-LEVEL SMOKE-TEST (mental).
    - Mentally click through your page from cold load.
    - List every state transition. For each, identify what should appear
      and confirm the JSX renders it.

T11 NO REGRESSION OF SHIPPED BEHAVIOR.
    - Existing features (live YOLO camera, Gemini multimodal calls,
      simulated sensor streams, etc.) must keep working. Don't strip the
      "visible engine" widgets to clean up code.

T12 ALL FIXES STAY WITHIN YOUR OWNERSHIP. If you find a bug outside
    your scope, list it under "## Out-of-scope findings". Do not edit
    other agents' files.

T13 BUILD MUST PASS for your scope. Run \`tsc --noEmit\` on whichever
    side (backend / frontend) you touched. Report the result.

T14 NO FORBIDDEN WORDS in user-visible strings: demo, showcase,
    hackathon, prototype, hack. Treat product as live production.

T15 LAYOUT STABILITY. No async content swap should shift layout. Use
    skeletons that match the final dimensions.

T16 BACKEND IMPORTS use .js extensions (NodeNext).

REPORT FORMAT (mandatory):
  ## Files modified
  (one absolute path per line)

  ## Bugs found and fixed
  (bullet list — be specific: file, what was wrong, what you changed)

  ## Out-of-scope findings
  (bugs in files you can't edit — file:line + description)

  ## Build result
  "BACKEND_TSC: ok" or "BACKEND_TSC: <first 5 error lines>"
  "FRONTEND_TSC: ok" or "FRONTEND_TSC: <first 5 error lines>"
=================================================================================
`

const AGENTS = [
  {
    id: 'V1',
    label: 'verification-slice',
    title: 'Verification slice (box-count, shipment-diff, rfid, weight-check)',
    pages: [
      'frontend/src/pages/box-count/**',
      'frontend/src/pages/shipment-diff/**',
      'frontend/src/pages/rfid-verification/**',
      'frontend/src/pages/weight-check/**',
    ],
    routers: [
      'backend/src/routers/boxCount.ts',
      'backend/src/routers/shipmentDiff.ts',
      'backend/src/routers/rfid.ts',
      'backend/src/routers/weightCheck.ts',
    ],
    models: [
      'backend/src/models/BoxCountResult.ts',
      'backend/src/models/ShipmentDiff.ts',
      'backend/src/models/RfidScanResult.ts',
      'backend/src/models/WeightCheck.ts',
    ],
    extra: `
SLICE-SPECIFIC TRACES:

box-count:
  - The live camera lifecycle: idle → starting → live → saved → idle.
    Trace every state transition. Verify camera stops on unmount even
    mid-session, and on browser tab close (visibilitychange).
  - YOLO offline: page must continue functioning with Gemini-only
    commentary. Confirm.
  - saveSession persists the right detectedCount (suspectedCount from
    Gemini > 0 ? suspectedCount : yolo total).
  - If declaredCount is missing or 0, the start button should be
    blocked with a clear inline error (not a toast that disappears).

shipment-diff:
  - Two-image upload: form blocks submit unless BOTH images present.
  - During analysis, scan-line plays smoothly. After analysis, scan-line
    stops and result card appears WITHOUT layout shift.
  - The Gemini compare call returns JSON. Bad JSON path: user sees a
    descriptive error and form is re-enabled. Verify.
  - Risk score color map: emerald 0-30, amber 31-60, red 61-100.

rfid-verification:
  - Manifest tags input: comma-separated OR newline-separated, both
    work. Tags trimmed, deduped, case-insensitive on submit.
  - Simulated tag stream: timers fire on click, append fake tags to
    the terminal panel, then call the real mutation. Verify timers are
    cleaned up if user cancels mid-stream or unmounts.
  - Result card shows matched / missing / extra clearly. Empty arrays
    handled.

weight-check:
  - Sensor stream: fake readings drift and settle on measured value
    over ~4 seconds. Real mutation fires after. rAF cleaned up on
    unmount.
  - Negative or zero values rejected client-side AND server-side.
  - Deviation visual (scale needle) responds to result.

CROSS-FEATURE:
  - box-count mismatchPct > 20 → AnomalyReport written. Verify in
    the saveSession path (NOT verify path — saveSession is the live
    session flow).
  - shipment-diff riskScore > 70 → AnomalyReport written. Verify.
  - rfid matchPct < 80 → AnomalyReport written. Verify.
  - weight-check deviationPct > 15 AND flagged → AnomalyReport. Verify.
  - All four also write AuditEvent (failure-safe). Verify.
`,
  },
  {
    id: 'V2',
    label: 'intelligence-slice',
    title: 'Intelligence slice (anomaly, fraud, audit, trust-center, insights)',
    pages: [
      'frontend/src/pages/anomaly-detection/**',
      'frontend/src/pages/fraud-dashboard/**',
      'frontend/src/pages/audit-log/**',
      'frontend/src/pages/trust-center/**',
    ],
    routers: [
      'backend/src/routers/anomaly.ts',
      'backend/src/routers/fraud.ts',
      'backend/src/routers/audit.ts',
      'backend/src/routers/insights.ts',
    ],
    models: [
      'backend/src/models/AnomalyReport.ts',
      'backend/src/models/AuditEvent.ts',
    ],
    extra: `
SLICE-SPECIFIC TRACES:

anomaly-detection:
  - Six input fields render as drifting sparklines. On submit, all
    sparklines pulse and settle. After analyze, radar chart appears.
  - Verify the radar chart handles the case where Gemini returns
    severity but no flags array (defensive).

fraud-dashboard:
  - Aggregates across 5 models. Polling at 4-6s.
  - Pulse-on-increase: verify the previous-value ref pattern works
    (compare new vs prev). No infinite re-render loop.
  - Empty user (no data): tiles show "0" not "—" and not crash.

audit-log:
  - List shows events oldest-first per draft, newest-first global.
  - Hash chain visual: djb2 hash on (id+ts+eventType) → 8 hex chars,
    DETERMINISTIC per event. Copy-on-click works on http (Clipboard
    API) AND falls back gracefully on insecure contexts.
  - "Show more" affordance if events > 200.

trust-center:
  - Draft picker (uses inventory.getDrafts query).
  - draftBundle: shows score gauge, per-subsystem cards with
    "Open feature" deep-links to the matching page (with ?draftId=).
  - Empty draftId state: skeleton placeholders matching final layout
    so the panel transition is not jarring.
  - shipmentTrustScore failure (e.g., no data): gauge shows neutral
    70 with verdict "watch" per the contract.

INSIGHTS ROUTER (the integration backbone):
  - shipmentTrustScore({draftId}):
      * Returns the exact schema defined in CLAUDE.md/contract.
      * Missing subsystem data → neutral 70 weight 0.5.
      * Score clamped to [0,100]. Verdict bands: ≥80 trusted, ≥60 watch,
        else high-risk.
  - recentActivity({limit, draftId?}):
      * Returns a unified timeline. Each item has the icon name listed
        in the contract.
      * Failure of any one subsystem query MUST NOT empty the result —
        wrap each per-model fetch in try/catch and merge what succeeded.
  - draftBundle({draftId}):
      * Returns null for missing subsystems, not undefined, not throws.
  - operationsTicker({}):
      * 4s refetch from the dashboard. Verify the query is cacheable.
      * recentTicks length capped at 12.

CROSS-FEATURE:
  - Verify fraud.summary reads ALL the models the verification slice
    writes to. If a model is missing from the read set, add it.
  - Verify recentActivity surfaces events from box-count, shipment-diff,
    rfid, weight, anomaly, audit, tracking, load, truck, compliance.
    If any are missing, add them.
`,
  },
  {
    id: 'V3',
    label: 'operations-slice',
    title: 'Operations slice (load-aggregation, live-tracking, truck-registry)',
    pages: [
      'frontend/src/pages/load-aggregation/**',
      'frontend/src/pages/live-tracking/**',
      'frontend/src/pages/truck-registry/**',
    ],
    routers: [
      'backend/src/routers/loadMatch.ts',
      'backend/src/routers/tracking.ts',
      'backend/src/routers/trucks.ts',
    ],
    models: [
      'backend/src/models/LoadOffer.ts',
      'backend/src/models/TrackingPing.ts',
      'backend/src/models/Truck.ts',
    ],
    extra: `
SLICE-SPECIFIC TRACES:

load-aggregation:
  - createOffer mutation → listMine query refetch → findMatches against
    the new offer.
  - Match algorithm: verify the corridor matching logic actually
    matches case-insensitively, within +/- 2 days, combined weight
    <= 5000kg. Test mental cases:
      * exact match (score 100)
      * partial city match (substring either way)
      * over-weight (rejected)
      * out-of-window date (rejected)
      * matches the user's OWN offer (REJECTED — must be different
        userId, verify in code)
  - Corridor scan visual: SVG arc between origin → destination.
    Animation cleanup on unmount.
  - cancel: only the owner can cancel their offer.

live-tracking:
  - Real Google Map (@react-google-maps/api). Requires
    VITE_GOOGLE_MAPS_KEY env var. If missing, fall back to static
    visual.
  - ping mutation: validate lat/lng in [-90,90]/[-180,180].
    speed clamped <= 200 km/h.
  - ETA = distance / speed * 60 minutes. Verify distance is haversine
    and the formula is correct.
  - "Advance" button: rate-limit to 1 click/second on the client.
    Verify the visual ETA countdown ring updates.
  - latest query auto-refetches every N seconds. Map marker animates
    smoothly between updates (no jump).

truck-registry:
  - register → list refetch.
  - remove: confirm dialog before delete. Server-side ownership check.
  - Capacity ring deterministic by plate hash (no flicker on re-render).
  - Empty list shows the warm empty state with CTA.
  - Plate uniqueness per user? If not enforced, allow duplicates but
    flag them.

CROSS-FEATURE:
  - tracking.ping emits AuditEvent of eventType "tracking-ping" per
    the cross-feature contract. Verify.
  - LoadOffer documents should be returned in insights.recentActivity
    (the integration agent claims so — verify both ends).
`,
  },
  {
    id: 'V4',
    label: 'legacy-auth-slice',
    title: 'Legacy + Auth slice (auth, compliance, inventory, route-opt, news, profile, docs)',
    pages: [
      'frontend/src/pages/auth/**',
      'frontend/src/pages/compliance-check/**',
      'frontend/src/pages/inventory-management/**',
      'frontend/src/pages/route-optimization/**',
      'frontend/src/pages/news/**',
      'frontend/src/pages/profile/**',
      'frontend/src/pages/documentation/**',
    ],
    routers: [
      'backend/src/routers/auth.ts',
      'backend/src/routers/compliance.ts',
      'backend/src/routers/inventory.ts',
      'backend/src/routers/logistics.ts',
      'backend/src/legacy/auth.ts',
      'backend/src/legacy/compliance.ts',
    ],
    models: [
      'backend/src/models/User.ts',
      'backend/src/models/Draft.ts',
      'backend/src/models/SaveRoute.ts',
      'backend/src/models/ComplianceRecord.ts',
      'backend/src/models/NewsHistory.ts',
      'backend/src/models/ProductAnalysis.ts',
    ],
    other: [
      'backend/src/context.ts',
      'backend/src/middleware/auth.ts',
      'backend/src/config/passport.ts',
      'backend/src/config/multer.ts',
    ],
    extra: `
SLICE-SPECIFIC TRACES:

AUTH:
  - Email/password login:
      * Validate before submit.
      * Successful login → JWT in localStorage.token → navigate to
        /dashboard.
      * Failed login → toast + form stays populated.
  - Create account: same path, plus client-side password strength
    (>=6 chars). Server already enforces.
  - Google OAuth: /auth/google → callback redirects to
    \${FRONTEND_URL}/?token=... The frontend root page MUST consume
    that token (read query param, persist to localStorage, replace
    URL, navigate to /dashboard). Verify the consumer exists.
  - ProtectedRoute: uses trpc.auth.getMe with retry: false. On
    401, navigate to /. On success, render Outlet.

COMPLIANCE WIZARD:
  - Multi-step form: state persists across step changes.
  - On successful Gemini call, result page renders.
  - CSV upload: PapaParse on client, createDraftFromCsv mutation,
    show row-by-row errors clearly.
  - The Gemini call in compliance router: missing-key check, try/catch,
    JSON parse safety.

INVENTORY:
  - Drafts list, tabs (yet-to-check, compliant, non-compliant,
    ready-for-shipment). Tab switch shouldn't lose scroll position.
  - Map view: requires Google Maps key; fall back if missing.
  - Export report: PDF generation via @react-pdf/renderer.

ROUTE OPTIMIZATION:
  - Long form. Submit calls logistics.optimize (or similar). Result
    shows route legs + carbon footprint deep-link.
  - Carbon footprint page: API call may fail (Carbon Interface key
    missing) — fall back to a clear "carbon data unavailable" state.

NEWS:
  - inventory.getNews (or whichever procedure). Cached server-side.
  - List, pagination, image alt text.

PROFILE:
  - getMe → render. Edit fields → updateProfile mutation. Photo
    upload via /api/user/upload-photo (legacy REST).
  - Delete account: confirm dialog (current behavior?).
  - History page: per-user history.

DOCUMENTATION:
  - Static rendering. Scroll-anchored TOC.

CROSS-FEATURE:
  - Verify FRONTEND_URL env handling in legacy auth callback.
  - Verify the multer upload error paths return JSON (not HTML
    error pages).
  - The OAuth redirect target must include the token consumption
    logic in the frontend root page. If missing, ADD it.
`,
  },
  {
    id: 'V5',
    label: 'shell-shared-slice',
    title: 'Shell + shared slice (App, Header, Dashboard, components, lib, _app, index)',
    pages: [
      'frontend/src/App.tsx',
      'frontend/src/main.tsx',
      'frontend/src/components/**',
      'frontend/src/pages/dashboard/**',
      'frontend/src/lib/**',
      'frontend/src/context/**',
    ],
    routers: [
      'backend/src/routers/_app.ts',
      'backend/src/index.ts',
      'backend/src/trpc.ts',
    ],
    models: [],
    other: [
      'backend/src/lib/db.ts',
      'backend/src/lib/auth.ts',
      'backend/src/lib/routeConstants.ts',
      'backend/src/utils/geocode.ts',
      'backend/src/schemas/user.ts',
    ],
    extra: `
SLICE-SPECIFIC TRACES:

App.tsx:
  - Every protected route is INSIDE the ProtectedRoute layout. Every
    public route (/, /createAccount) is OUTSIDE.
  - Verify no duplicate route definitions.
  - Verify the root path "/" handles the OAuth callback (?token=…)
    correctly. If it doesn't, FIX it — extract token, store in
    localStorage, replace URL, navigate to /dashboard. Otherwise the
    Google login flow lands users on the login screen forever.

Header.tsx + Breadcrumb.tsx:
  - Breadcrumb mapping table includes all 10 verification routes
    and trust-center. Unknown routes degrade to "Home › Page".
  - Header stays sticky/glass without overlapping content.

Dashboard.tsx + DashboardHero.tsx:
  - operationsTicker query: refetchInterval 4s. Stale-while-revalidate
    behavior (don't flash empty between refetches).
  - TrustGauge: tweens from prev to new score; doesn't re-animate on
    every refetch.
  - FeatureGroupGrid: every card links to its route. No dead links.
    Verify the route paths match App.tsx exactly.

Components:
  - CountUp: prefers-reduced-motion, rAF cleanup, negative deltas
    handled. Verify.
  - InsightsRail: skeleton, empty, error states. Cap items.
  - DraftPicker: keyboard nav, sessionStorage persistence.
  - TrustGauge: role="meter", aria-valuenow.
  - OperationsTicker: CSS scroll, pause on hover and document hidden.
  - ChatbotDrawer: focus trap, Escape closes, aria-modal.
  - ProtectedRoute: loading skeleton matches a real page layout.
  - ErrorBoundary at App root: catches render errors, renders fallback.
    If missing, ADD it.

trpc client:
  - trpcProvider: queryClient defaults staleTime: 5_000, retry: 1.
  - Authorization header reads localStorage.token on every request.

BACKEND SHELL:
  - _app.ts registers EVERY router exactly once. No duplicates.
  - index.ts mounts tRPC, mounts legacy auth router, mounts legacy
    compliance router. CORS origin from FRONTEND_URL.
  - Production guard: missing MONGODB_URI or JWT_SECRET throws at boot
    (don't run with silently missing config).
  - JSON error formatter middleware: unknown routes return JSON 404,
    not Express's HTML default.
  - Graceful shutdown: SIGTERM closes Mongoose connection. (If not
    present, add it.)
  - trpc.ts errorFormatter: ensure stack traces never leak to client
    in production.

CROSS-FEATURE:
  - The auth context (ctx.user) is read by every protectedProcedure.
    Verify lib/auth.ts requireUserId is the single source of truth.
  - The insights router is registered in _app.ts (it should be — verify).
`,
  },
]

function buildAgentPrompt(a, allAgents) {
  const ownLines = []
  ownLines.push('  Frontend pages/components:')
  ;(a.pages ?? []).forEach((p) => ownLines.push('    - ' + p))
  ownLines.push('  Backend routers:')
  ;(a.routers ?? []).forEach((p) => ownLines.push('    - ' + p))
  if (a.models && a.models.length) {
    ownLines.push('  Backend models:')
    a.models.forEach((p) => ownLines.push('    - ' + p))
  }
  if (a.other && a.other.length) {
    ownLines.push('  Other backend:')
    a.other.forEach((p) => ownLines.push('    - ' + p))
  }

  const otherOwnerships = allAgents
    .filter((x) => x.id !== a.id)
    .map((x) => {
      const lines = []
      ;(x.pages ?? []).forEach((p) => lines.push('      - ' + p))
      ;(x.routers ?? []).forEach((p) => lines.push('      - ' + p))
      ;(x.models ?? []).forEach((p) => lines.push('      - ' + p))
      ;(x.other ?? []).forEach((p) => lines.push('      - ' + p))
      return `    ${x.id} ${x.label}:\n${lines.join('\n')}`
    })
    .join('\n')

  return `You are Agent ${a.id} — ${a.title}.

REPO ROOT: ${REPO}

=================================================================================
YOUR EXCLUSIVE OWNERSHIP (only you may write to these)
=================================================================================
${ownLines.join('\n')}

You MAY READ any file in the repo for context.
You MUST NOT write to any file owned by another agent.

=================================================================================
SLICE-SPECIFIC DIRECTIVES
=================================================================================
${a.extra}

${COMMON_RULES}

=================================================================================
OTHER AGENTS' OWNERSHIP (read-only awareness)
=================================================================================
${otherOwnerships}

=================================================================================
PROCESS
=================================================================================
1. List every page / router / model in your scope.
2. For each, READ THE FULL FILE.
3. Apply T1-T16 to each. Be ruthless about real bugs.
4. Cross-check the integration points listed in your slice extras.
5. Run \`cd ${REPO}/backend && npx tsc --noEmit\` if you touched backend.
6. Run \`cd ${REPO}/frontend && npx tsc --noEmit\` if you touched frontend.
7. Produce the report in the format specified.
`
}

// Validator — write a structured report by parsing CLI output directly
// (no schema, no StructuredOutput dependency)

const VALIDATOR_PROMPT = `Validate the e2e correctness sweep. Run these commands and report.

Run (each with 5min timeout):
  1. cd ${REPO}/backend  && npx tsc --noEmit
  2. cd ${REPO}/frontend && npx tsc --noEmit
  3. cd ${REPO}/frontend && npm run lint
  4. cd ${REPO}/frontend && npx vite build
  5. cd ${REPO}/frontend/src && grep -rni -E '\\b(demo|showcase|hackathon|prototype)\\b' . 2>/dev/null | grep -v node_modules | grep -v dist

Respond as plain text with EXACTLY these sections (no markdown headings, just the bare lines):

BACKEND_TSC: ok
or
BACKEND_TSC: fail
<first 20 error lines>
END_BACKEND_TSC

FRONTEND_TSC: ok|fail
... etc for FRONTEND_TSC, LINT, BUILD, FORBIDDEN_WORDS

Each section's body should ONLY appear if status is fail / has hits. Status line is always present.`

function buildFixerPrompt(validatorReport) {
  return `Final fixer. Five Opus agents just completed an e2e correctness sweep. The validator returned this report:

================ VALIDATOR REPORT ================
${validatorReport}
==================================================

RULES:
- Fix only the errors above.
- No @ts-ignore unless strictly necessary.
- Don't strip behavior to silence errors.
- Backend imports must end in .js (NodeNext).
- For forbidden words: replace with neutral production language.

After fixing, re-run the four validation commands and report final status.`
}

// ────────────────────────────────────────────────────────────────────────────

phase('Trace & fix')
const results = await parallel(
  AGENTS.map((a) => () =>
    agent(buildAgentPrompt(a, AGENTS), {
      label: a.label,
      phase: 'Trace & fix',
      model: 'opus',
    })
  )
)

log(`Slice agents done: ${results.filter(Boolean).length}/${AGENTS.length}`)

phase('Validate')
const validatorReport = await agent(VALIDATOR_PROMPT, {
  label: 'validator',
  phase: 'Validate',
  model: 'sonnet',
})

const lower = (validatorReport ?? '').toLowerCase()
const needsFix =
  /backend_tsc:\s*fail/.test(lower) ||
  /frontend_tsc:\s*fail/.test(lower) ||
  /lint:\s*fail/.test(lower) ||
  /build:\s*fail/.test(lower) ||
  /forbidden_words:\s*fail/.test(lower) ||
  /forbidden_words:\s*\d+\s*hit/.test(lower)

let fixResult = null
if (needsFix) {
  phase('Fix')
  fixResult = await agent(buildFixerPrompt(validatorReport), {
    label: 'fixer',
    phase: 'Fix',
    model: 'sonnet',
  })
}

return {
  agents: AGENTS.map((a) => ({ id: a.id, label: a.label })),
  results,
  validatorReport,
  fixResult,
  needsFix,
}
