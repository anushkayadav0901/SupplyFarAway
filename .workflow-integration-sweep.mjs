export const meta = {
  name: 'integration-sweep',
  description: '3 Opus agents in parallel: backend integrity + insights, frontend feature polish + visible engines, dashboard + global trust shell. Then validate + fix.',
  phases: [
    { title: 'Sweep', model: 'opus' },
    { title: 'Validate' },
    { title: 'Fix' },
  ],
}

const REPO = '/Users/ayux/Coding/base'

const INSIGHTS_CONTRACT = `
=================================================================================
INTEGRATION CONTRACT — the unified insights API
=================================================================================

Agent A implements this in backend/src/routers/insights.ts. Agents B and C consume
these by name even though the router doesn't exist yet — the integration agent will
register it. Procedures (all protectedProcedure):

trpc.insights.shipmentTrustScore.useQuery({ draftId: string })
  → {
      score: number,            // 0-100, weighted aggregate
      verdict: 'trusted' | 'watch' | 'high-risk',
      breakdown: {
        boxCount:     { score: number, weight: number, latestAt: Date | null, note: string },
        shipmentDiff: { score: number, weight: number, latestAt: Date | null, note: string },
        rfid:         { score: number, weight: number, latestAt: Date | null, note: string },
        weight:       { score: number, weight: number, latestAt: Date | null, note: string },
        anomaly:      { score: number, weight: number, latestAt: Date | null, note: string },
        compliance:   { score: number, weight: number, latestAt: Date | null, note: string }
      },
      signals: Array<{ type: string, value: number, contribution: number }>  // sorted desc by contribution
    }

trpc.insights.recentActivity.useQuery({ limit?: number, draftId?: string })
  → Array<{
      id: string,
      type: 'box-count' | 'shipment-diff' | 'rfid' | 'weight' | 'anomaly' | 'audit'
          | 'tracking' | 'load' | 'truck' | 'compliance',
      timestamp: string,        // ISO
      summary: string,
      severity?: 'low' | 'medium' | 'high',
      draftId?: string,
      icon: string              // semantic name: 'package' | 'scan' | 'tag' | 'scale' | 'alert' | 'shield' | 'map' | 'truck' | 'audit' | 'check'
    }>

trpc.insights.draftBundle.useQuery({ draftId: string })
  → {
      draft: Draft | null,
      boxCount: BoxCountResult | null,
      shipmentDiff: ShipmentDiff | null,
      rfid: RfidScanResult | null,
      weight: WeightCheck | null,
      anomaly: AnomalyReport | null,
      latestPing: TrackingPing | null,
      audit: AuditEvent[],
      compliance: ComplianceRecord | null
    }

trpc.insights.operationsTicker.useQuery({}, { refetchInterval: 4000 })
  → {
      activeShipments: number,
      openLoads: number,
      registeredTrucks: number,
      highRiskEventsLast24h: number,
      avgTrustScore: number,           // average over all drafts the user owns
      avgTrustScoreDelta: number,      // vs 24h ago
      recentTicks: Array<{ type: string, summary: string, ts: string, severity?: 'low'|'medium'|'high' }>
    }

Scoring rules for shipmentTrustScore:
  - Each subsystem returns 0-100. Missing data = neutral 70 with weight 0.5.
  - Default weights: boxCount=1.0, shipmentDiff=1.2, rfid=1.0, weight=0.8, anomaly=1.3, compliance=0.9.
  - boxCount.score:     100 - min(100, mismatchPct * 2)
  - shipmentDiff.score: 100 - riskScore
  - rfid.score:         matchPct
  - weight.score:       flagged ? max(0, 100 - deviationPct * 5) : 100
  - anomaly.score:      100 - riskScore; severity high adds -10 floor
  - compliance.score:   if ComplianceRecord has riskScore field, 100 - riskScore; else neutral.
  - verdict: score >= 80 → 'trusted', >= 60 → 'watch', else 'high-risk'.

Audit hooks (Agent A also enforces):
  - On every verification mutation across boxCount, shipmentDiff, rfid, weightCheck,
    anomaly: also create an AuditEvent (eventType, payload, summary) for traceability.
    Use the existing AuditEventModel directly (do not call the audit router).
  - Failure to log audit must NOT fail the parent mutation — wrap in try/catch and log.
=================================================================================
`

const VISUAL_DIRECTION = `
=================================================================================
DESIGN PRINCIPLES (must follow strictly)
=================================================================================
1. NO LAYOUT SHIFT. Every async section renders a skeleton with the same
   dimensions as the loaded state. Use framer-motion AnimatePresence for swaps.
   Existing deps: framer-motion, recharts, react-toastify, lucide-react,
   react-globe.gl, @react-google-maps/api, @lottiefiles/dotlottie-react,
   chart.js + react-chartjs-2, gsap.

2. VISIBLE ENGINES. Every feature that uses Gemini behind the scenes must ALSO
   surface a visible secondary "engine" — a panel, gauge, sparkline, or stream
   that makes the technology tactile. This is the YOLO principle: Gemini does
   the heavy lifting, but the user sees a discrete YOLO box detector. Examples:

   - rfid:           Antenna pulse animation + simulated tag-detection stream
                     (start a fake stream when the user clicks "scan", run
                     1-3s, then call the real mutation)
   - weight-check:   Simulated load-cell sensor stream (5-second chart that
                     stabilises into the entered value) BEFORE submitting
   - anomaly:        Live "signal panel" with the 6+ input metrics drifting
                     before settling, plus a radar/spider chart of the result
   - shipment-diff:  Two-up image upload with a sweep animation across both
                     during analysis
   - load-aggregation: Animated "corridor scan" between cities — show a
                     mini-map (or stylised arc) sweeping as matches are
                     found; iterative reveal of matches with a stagger
   - live-tracking:  Real Google Map (we have @react-google-maps/api) with
                     animated marker movement + ETA countdown ring
   - audit-log:      Blockchain-style hash chain visual — short hex hashes
                     on each event, "chain" between them, copy-on-click
   - fraud-dashboard: Recharts radial + line. Pulse on high-severity entries.
   - truck-registry: Capacity-utilization ring per truck card
   - box-count:      Already done (live YOLO camera) — only polish to match
                     the rest

3. CROSS-FEATURE EMBEDS. Every feature page renders a right-rail panel
   showing live signals from other features for the same shipment context
   (use trpc.insights.recentActivity with optional draftId; if no draft is
   selected, show global recent activity).

4. NO MENTION of "demo", "showcase", "presentation", "hackathon", "hack",
   "prototype", "MVP" in any UI copy, comment, button label, or tooltip.
   Treat this product as live production logistics infrastructure.

5. ANIMATION BUDGET. ~150-250ms per transition. Use framer-motion variants.
   60fps target. No bouncy springs on critical UI elements (they look
   unserious).

6. NUMBER ANIMATIONS. All score/count tiles animate from previous value to
   new value over ~400ms using a count-up technique (cheapest: a useEffect
   that tweens between values via requestAnimationFrame). Don't use a
   library — write a tiny CountUp wrapper.

7. SKELETONS, NOT SPINNERS. Where data is loading, render a card-shaped
   pulsing skeleton that matches the final layout. Spinners only for
   button-level loading states (during mutation).

8. ONE COLOR SYSTEM. Tailwind v4 with the existing CSS vars. Primary blue
   (--color-blue-500/600), success emerald, danger red, warning amber,
   slate text. Do NOT introduce new accent colors. Glass-blur is OK on
   header and dashboard hero. Cards: rounded-2xl, border-slate-200,
   shadow-sm.

9. KEY PAGES MUST FEEL ALIVE. Subscribe to insights.operationsTicker with
   refetchInterval: 4000 on the Dashboard. Subscribe to recentActivity
   with refetchInterval: 6000 on feature pages.

10. EMPTY STATES are warm and instructive, not blank. Lucide icon + 1-line
    direction + a primary CTA.
=================================================================================
`

const AGENT_A_PROMPT = `You are Agent A — Backend integrity, normalization, and the cross-feature insights layer.

REPO ROOT: ${REPO}

YOU OWN (exclusive write access):
  backend/src/** (every file under backend/src, including _app.ts)

YOU MUST NOT TOUCH:
  frontend/** (Agents B and C own all frontend code)
  yolo/** (Python service)
  *.md (no docs)

═══════════════════════════════════════════════════════════════
TASKS
═══════════════════════════════════════════════════════════════

1) CREATE backend/src/routers/insights.ts implementing the contract below
   exactly. Register it in backend/src/routers/_app.ts as 'insights'.

2) AUDIT HOOK: every mutation in boxCount, shipmentDiff, rfid, weightCheck,
   and anomaly routers must also create an AuditEvent. Use the
   AuditEventModel directly (import from ../models/AuditEvent.js). Wrap
   in try/catch — audit failure must NEVER bubble up to the parent mutation.

3) NORMALIZE error handling across all 10 feature routers. Replace any
   bare throws or untyped errors with TRPCError. Standardise the "invalid
   userId" check into a shared helper:
     backend/src/lib/auth.ts  →  exports requireUserId(ctx) which returns
     a validated mongoose.Types.ObjectId or throws TRPCError BAD_REQUEST.
   Migrate ALL routers (auth, inventory, compliance, logistics, boxCount,
   shipmentDiff, loadMatch, tracking, anomaly, rfid, weightCheck, fraud,
   trucks, audit) to use requireUserId(ctx).

4) BUG FIX SWEEP — read each router file and find runtime bugs:
   - Gemini calls without try/catch wrappers around JSON.parse
   - Mongoose queries that assume a doc exists without null-checking
   - Missing input validation (e.g., negative numbers where positive is required)
   - Schema field mismatches (a router writes a field the model doesn't have)
   - Unhandled promise rejections
   Fix each. Do not leave TODOs.

5) DEAD CODE & CONSISTENCY:
   - Remove unused imports
   - Standardise import order: external → internal → models → schemas → trpc helpers
   - Backend uses NodeNext — every relative import MUST end in .js. Verify.

6) CROSS-FEATURE LINKAGE on existing routers:
   - boxCount.saveSession: after saving, also write an AnomalyReport stub
     if mismatchPct > 20 (use AnomalyReportModel directly), severity
     'medium', flags ['box-count-mismatch'], summary built from the result.
     Wrap in try/catch.
   - shipmentDiff.compare: same pattern — if riskScore > 70, emit a
     high-severity AnomalyReport.
   - weightCheck.submit: if flagged AND deviationPct > 15, emit
     AnomalyReport with flags ['weight-mismatch'].
   - rfid.verify: if matchPct < 80, emit AnomalyReport with flags
     ['rfid-shortfall'].
   - tracking.ping: no anomaly emit, but DO emit AuditEvent of
     eventType='tracking-ping'.

7) UPDATE backend/src/routers/_app.ts to register the new 'insights'
   router alongside the existing routers. Use NodeNext .js import.

8) BUILD: \`cd ${REPO}/backend && npx tsc --noEmit\` must succeed cleanly
   when you're done. Run it yourself and fix anything that breaks.

${INSIGHTS_CONTRACT}

When done, respond with:
  - Files modified (one absolute path per line)
  - Final \`tsc --noEmit\` result line: "BACKEND_TSC: ok" or the first 10 error lines
`

const AGENT_B_PROMPT = `You are Agent B — Feature page polish, cross-feature embeds, and visible "engine" widgets.

REPO ROOT: ${REPO}

YOU OWN (exclusive write access):
  frontend/src/pages/box-count/**            (touch-up only — page is already live YOLO; bring it up to the new visual system)
  frontend/src/pages/shipment-diff/**
  frontend/src/pages/rfid-verification/**
  frontend/src/pages/weight-check/**
  frontend/src/pages/anomaly-detection/**
  frontend/src/pages/load-aggregation/**
  frontend/src/pages/live-tracking/**
  frontend/src/pages/truck-registry/**
  frontend/src/pages/audit-log/**
  frontend/src/pages/fraud-dashboard/**
  frontend/src/lib/insights.ts                (NEW — shared helpers for trust scoring colors etc; create only if useful)
  frontend/src/components/skeletons/          (NEW directory — shared skeletons; create only if useful)
  frontend/src/components/CountUp.tsx         (NEW — tiny animated number tween)
  frontend/src/components/InsightsRail.tsx    (NEW — right-rail of recent activity for a feature page)

YOU MUST NOT TOUCH:
  backend/**
  frontend/src/App.tsx
  frontend/src/main.tsx
  frontend/src/pages/dashboard/**
  frontend/src/components/Header.tsx
  frontend/src/components/ProtectedRoute.tsx
  frontend/src/pages/auth/**
  frontend/src/pages/profile/**
  frontend/src/pages/compliance-check/**       (Agent C may touch existing compliance/inventory pages if needed; you stay out)
  frontend/src/pages/inventory-management/**
  frontend/src/pages/route-optimization/**
  frontend/src/pages/documentation/**
  frontend/src/pages/news/**

═══════════════════════════════════════════════════════════════
TASKS PER FEATURE PAGE
═══════════════════════════════════════════════════════════════

Apply ALL of the following to each feature page in your scope:

1) SKELETON LOAD: while initial data is loading, render pulse skeletons
   that match the final dimensions exactly. No layout shift.

2) LIVE EMBEDS: add an InsightsRail (you'll create this shared component)
   on the right side (lg:col-span-4) showing trpc.insights.recentActivity
   with refetchInterval: 6000. If the page has a current draftId, pass
   it; else show global activity.

3) NUMBER ANIMATIONS: use your CountUp component for every prominent
   metric tile (score, percent, count). Tween 400ms.

4) MICRO-INTERACTIONS via framer-motion: card hover lifts, button taps,
   AnimatePresence for inserted result rows.

5) NO "DEMO" wording anywhere. Treat this as live infrastructure.

6) FEATURE-SPECIFIC "VISIBLE ENGINE" REQUIREMENT (this is the YOLO principle):

   shipment-diff:
     - Two-up image upload (before/after)
     - During analysis, animate a vertical scan-line across each image
     - Result card: risk score in a large animated gauge, missing items
       as red chips, damage description as a quoted block

   rfid-verification:
     - Antenna animation (concentric circles pulsing outward) above the
       form. When the user clicks "scan", run a fake 2-second simulated
       "tag stream" — append fake tag IDs into a small terminal-style
       panel one at a time, then call the real mutation. The simulated
       tags should match a subset of the entered manifest tags so the
       stream "discovers" them visually.
     - Result: matched/missing/extra as colored chip rails

   weight-check:
     - Above the form, a "Load Sensor Stream" chart that shows simulated
       sensor pings (use recharts LineChart). When the user enters a
       declared and measured weight and clicks "stream", run a 4-second
       simulated readings sequence that drifts and settles on the
       measured value, then call the real mutation.
     - Result: a tare-style scale visual with the needle animating to
       the deviation

   anomaly-detection:
     - Six input fields render as "signal lines" (small sparklines that
       drift while idle). On submit, all six sparklines pulse, then the
       result shows a radar/spider chart (recharts Radar) of severity
       contributions.
     - Verdict chip: trusted / watch / high-risk

   load-aggregation:
     - On 'findMatches', show a "corridor scan" sweep across an
       inline route arc visual (SVG arc between origin → destination
       cities). Then reveal matches with stagger.
     - Each match card shows the similarityScore as a small ring.

   live-tracking:
     - Real Google Map using @react-google-maps/api. Plot the destination
       and the latest ping. Show a polyline from current → destination.
     - ETA countdown ring around a clock icon.
     - Driver simulated movement: a "Move 0.005° toward destination"
       button that calls ping mutation with slightly updated coords —
       enough to demo motion. Label it "Advance" (NOT "demo step").

   audit-log:
     - Blockchain-style chain visual. Each AuditEvent renders as a card
       with a short hex hash (compute on client from id+eventType+ts via
       a tiny djb2-style hash → first 8 hex chars). Connect cards with
       a vertical chain glyph. Copy-on-click for full hash.

   fraud-dashboard:
     - Three sections: at-a-glance tiles, risk pulse chart (recharts Area
       with last 30 events), and a recent activity feed.
     - Pulse animation on tiles when value increases.

   truck-registry:
     - Truck cards in a grid. Each card: capacity ring (circular SVG
       progress 0-100% — for now compute as random% if no usage data;
       label "capacity"), plate, driver, base city.
     - Empty state: lucide truck icon + warm CTA.

   box-count:
     - Already largely done. Add InsightsRail on the right column and a
       CountUp on the four StatTiles. Keep the camera and YOLO logic
       intact.

7) ANY page that takes a draftId input should expose a small "Pick draft"
   button that opens a dropdown of the user's drafts (use
   trpc.inventory.getDrafts.useQuery). On selection, set draftId state
   and auto-refetch related panels.

8) ERROR STATES: every mutation that fails toasts the message. Pages
   never end up blank on error — show a small inline retry block.

${VISUAL_DIRECTION}

═══════════════════════════════════════════════════════════════
TYPECHECK
═══════════════════════════════════════════════════════════════
\`cd ${REPO}/frontend && npx tsc --noEmit\` must be clean when you're done.
Pre-emptively cast tRPC returns through 'unknown' if you hit the Mongoose
ObjectId-vs-string TS2352 pattern that already exists in this codebase.

When done, respond with:
  - Files modified (one absolute path per line)
  - Final \`tsc --noEmit\` result line
`

const AGENT_C_PROMPT = `You are Agent C — Global app shell, dashboard hero, trust index gauge, operations ticker.

REPO ROOT: ${REPO}

YOU OWN (exclusive write access):
  frontend/src/App.tsx
  frontend/src/main.tsx
  frontend/src/components/Header.tsx
  frontend/src/components/ProtectedRoute.tsx
  frontend/src/components/ChatbotDrawer.tsx                (only minor polish if needed)
  frontend/src/components/ThemeToggle.tsx                  (untouched unless broken)
  frontend/src/pages/dashboard/**
  frontend/src/pages/trust-center/**                       (NEW page: a unified per-draft trust view)
  frontend/src/components/TrustGauge.tsx                   (NEW — circular gauge)
  frontend/src/components/OperationsTicker.tsx             (NEW — live ticker strip)
  frontend/src/components/FeatureGroupGrid.tsx             (NEW — grouped feature nav)
  frontend/src/components/Breadcrumb.tsx                   (NEW — auto from URL)
  frontend/src/components/skeletons/                       (You may also create here; merge with Agent B by best-effort if both create the same file — if conflict, Agent C's wins.)

YOU MUST NOT TOUCH:
  backend/**
  yolo/**
  frontend/src/pages/box-count/**
  frontend/src/pages/shipment-diff/**
  frontend/src/pages/rfid-verification/**
  frontend/src/pages/weight-check/**
  frontend/src/pages/anomaly-detection/**
  frontend/src/pages/load-aggregation/**
  frontend/src/pages/live-tracking/**
  frontend/src/pages/truck-registry/**
  frontend/src/pages/audit-log/**
  frontend/src/pages/fraud-dashboard/**
  frontend/src/lib/insights.ts            (Agent B may create this)
  frontend/src/components/CountUp.tsx     (Agent B owns)
  frontend/src/components/InsightsRail.tsx (Agent B owns)

═══════════════════════════════════════════════════════════════
TASKS
═══════════════════════════════════════════════════════════════

1) HERO TRUST INDEX on Dashboard:
   - Top of the dashboard: a Trust Gauge component (circular SVG, 0-100)
     showing trpc.insights.operationsTicker.avgTrustScore.
     refetchInterval: 4000.
   - Right of the gauge: 4 tiles — Active Shipments, Open Loads,
     Registered Trucks, High-Risk Events 24h. Each tile uses CountUp
     (import from Agent B's path — assume it exists).
   - Below: OperationsTicker — a horizontally scrolling strip of the
     latest 12 ticks. Auto-scroll using CSS keyframes or framer.

2) GROUPED FEATURE GRID replacing the existing scattered nav:
   - Verification: box-count, shipment-diff, rfid, weight-check
   - Intelligence: anomaly-detection, fraud-dashboard, audit-log
   - Operations: load-aggregation, truck-registry, live-tracking
   - Each group is a section with a tasteful header + 4-column grid of
     feature cards. Card: lucide icon, title, 1-line desc, hover lift.
   - Keep existing dashboard sections (LiveStatsSection, AboutSection,
     FeatureCarousel) below the new grouped grid — DO NOT delete them,
     just compose around them. If LiveStatsSection now duplicates the
     hero tiles, hide it on the Dashboard render but keep the file.

3) BREADCRUMB header:
   - Header gains a left-aligned breadcrumb derived from the URL path
     (e.g., "/box-count" → "Verification › Box Count"). Use a tiny
     mapping table inside Breadcrumb.tsx.
   - Replace the existing static title prop with a smart resolution
     from the URL if the page passes title=""; otherwise honour the
     page's title.

4) TRUST CENTER PAGE (NEW) — frontend/src/pages/trust-center/TrustCenter.tsx
   - URL: /trust-center  (you add this Route in App.tsx inside ProtectedRoute)
   - User picks a draft from a dropdown
   - Page renders trpc.insights.draftBundle({ draftId }) — shows a
     unified card per subsystem with status + score + last-event time
     + a "Open feature" deep-link
   - Trust Gauge at the top showing shipmentTrustScore for the draft
   - Add a nav card on Dashboard's Intelligence group linking here
   - Page must skeleton-load gracefully even when draftId is empty

5) SKELETONS EVERYWHERE on Dashboard. No layout shift between
   data-loading and data-loaded states.

6) APP-SHELL UPGRADES (frontend/src/App.tsx):
   - Add the new <Route path="/trust-center" element={<TrustCenter />} />
     inside the existing ProtectedRoute wrapper.
   - Do NOT change or remove any existing route.

7) CHATBOT DRAWER: leave functionality as is, but ensure it does not
   overlap the new ticker or breadcrumb. If it does, adjust its z-index
   or margin.

8) ENSURE existing pages (compliance, inventory, route-optimization,
   news, profile, documentation, auth) are NOT broken by your edits to
   Header.tsx. The new Header must be backward-compatible:
   <Header title="..." /> still works.

${VISUAL_DIRECTION}

═══════════════════════════════════════════════════════════════
TYPECHECK
═══════════════════════════════════════════════════════════════
\`cd ${REPO}/frontend && npx tsc --noEmit\` must be clean when you're done.

When done, respond with:
  - Files modified (one absolute path per line)
  - Final \`tsc --noEmit\` result line
`

const VALIDATOR_PROMPT = `Validate the integration sweep.

Run:
  1. \`cd ${REPO}/backend && npx tsc --noEmit\`         (timeout 5min)
  2. \`cd ${REPO}/frontend && npx tsc --noEmit\`        (timeout 5min)
  3. \`cd ${REPO}/frontend && npm run lint\`            (timeout 5min)
  4. \`cd ${REPO}/frontend && npx vite build\`          (timeout 5min)

Return the structured result via StructuredOutput. For each step:
  - exit 0 → ok=true, errors=[]
  - exit non-zero → ok=false, errors = up to first 30 lines of error output

Also scan key UI text strings for forbidden words (case-insensitive):
  "demo", "showcase", "hackathon", "prototype", "MVP" (as a standalone
  word; "MVP" inside larger words is fine).
Search via:
  \`cd ${REPO}/frontend/src && grep -rni -E '\\b(demo|showcase|hackathon|hack|prototype)\\b' . | grep -v node_modules | grep -v dist\`
Capture findings as forbiddenWordHits (file:line strings).
`

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
  return `Final fixer. Some validation steps failed.

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
- No @ts-ignore unless every other option is exhausted.
- Preserve all functionality; do NOT delete features to silence errors.
- Backend imports must end in .js.
- For forbidden words: replace them with appropriate production language
  ("demo" → "session" or "live" or remove; "showcase" → "highlights" or
  remove; "MVP"/"prototype" → "platform" or remove). Use judgement.

After fixing, re-run all four commands and report:
  - Files edited
  - "BACKEND_TSC_FINAL", "FRONTEND_TSC_FINAL", "LINT_FINAL", "BUILD_FINAL":
    each "ok" or short error tail
  - Remaining forbidden hits (should be 0)
`
}

// ────────────────────────────────────────────────────────────────────────────
// Run
// ────────────────────────────────────────────────────────────────────────────

phase('Sweep')
const [a, b, c] = await parallel([
  () => agent(AGENT_A_PROMPT, { label: 'A:backend-integrity', phase: 'Sweep', model: 'opus' }),
  () => agent(AGENT_B_PROMPT, { label: 'B:feature-pages', phase: 'Sweep', model: 'opus' }),
  () => agent(AGENT_C_PROMPT, { label: 'C:dashboard-shell', phase: 'Sweep', model: 'opus' }),
])

log(`Sweep complete. A=${a ? 'ok' : 'null'}, B=${b ? 'ok' : 'null'}, C=${c ? 'ok' : 'null'}`)

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
  sweep: { A: a, B: b, C: c },
  validation,
  fix,
}
