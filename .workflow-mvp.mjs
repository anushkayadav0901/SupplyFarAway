export const meta = {
  name: 'mvp-e2e-features',
  description: 'Build 10 end-to-end logistics verification features in parallel, integrate, validate, and fix.',
  phases: [
    { title: 'Build features' },
    { title: 'Integrate' },
    { title: 'Validate' },
    { title: 'Fix errors' },
  ],
}

const REPO = '/Users/ayux/Coding/base'

const FEATURES = [
  {
    slug: 'box-count',
    routerKey: 'boxCount',
    model: 'BoxCountResult',
    page: 'BoxCount',
    route: '/box-count',
    title: 'Box Count Verification',
    icon: 'package',
    desc: 'Upload a shipment photo and compare the AI-detected box count against the declared manifest count.',
    procedures: [
      { name: 'verify', kind: 'mutation', inputZod: 'z.object({ draftId: z.string().optional(), declaredCount: z.number().int().positive(), imageBase64: z.string().min(10), mimeType: z.string().default("image/jpeg") })', behavior: 'Call Gemini 1.5 Flash multimodal (gemini-1.5-flash via @google/generative-ai) with a prompt: "Count the number of distinct boxes/packages visible in this image. Respond ONLY with a JSON object {\\"count\\": number, \\"confidence\\": number (0-1), \\"notes\\": string}". Parse the JSON. Persist a BoxCountResult document with detectedCount, declaredCount, mismatch=Math.abs(detectedCount-declaredCount)>0, mismatchPct, confidence, notes, userId, draftId. Return the saved doc.' },
      { name: 'history', kind: 'query', inputZod: 'z.object({ limit: z.number().int().positive().max(50).default(20) })', behavior: 'Return last N BoxCountResult docs for ctx.user, newest first.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), draftId (string, optional), declaredCount (number), detectedCount (number), mismatch (boolean), mismatchPct (number), confidence (number), notes (string), createdAt (Date, default now)',
  },
  {
    slug: 'shipment-diff',
    routerKey: 'shipmentDiff',
    model: 'ShipmentDiff',
    page: 'ShipmentDiff',
    route: '/shipment-diff',
    title: 'Damage & Tampering Diff',
    icon: 'compare',
    desc: 'Upload a loading photo and a delivery photo. AI estimates missing items, visible damage, and tampering probability with a 0–100 risk score.',
    procedures: [
      { name: 'compare', kind: 'mutation', inputZod: 'z.object({ draftId: z.string().optional(), beforeImageBase64: z.string().min(10), afterImageBase64: z.string().min(10), mimeType: z.string().default("image/jpeg") })', behavior: 'Call Gemini 1.5 Flash multimodal with both images. Prompt: "Compare these two shipment images (before loading vs after delivery). Respond ONLY with JSON: {\\"missingItems\\": string[], \\"damageDescription\\": string, \\"tamperingProbability\\": number (0-1), \\"riskScore\\": number (0-100), \\"summary\\": string}". Persist ShipmentDiff doc. Return saved doc.' },
      { name: 'history', kind: 'query', inputZod: 'z.object({ limit: z.number().int().positive().max(50).default(20) })', behavior: 'Return last N ShipmentDiff docs for ctx.user, newest first.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), draftId (string, optional), riskScore (number, 0-100), tamperingProbability (number), missingItems (string[]), damageDescription (string), summary (string), createdAt (Date, default now)',
  },
  {
    slug: 'load-aggregation',
    routerKey: 'loadMatch',
    model: 'LoadOffer',
    page: 'LoadAggregation',
    route: '/load-aggregation',
    title: 'Small Truck Load Aggregation',
    icon: 'truck',
    desc: 'Post loads with origin, destination, weight, and pickup date. Algorithm matches loads sharing route corridors and combinable capacity.',
    procedures: [
      { name: 'createOffer', kind: 'mutation', inputZod: 'z.object({ originCity: z.string().min(1), destinationCity: z.string().min(1), weightKg: z.number().positive(), pickupDate: z.string(), notes: z.string().optional() })', behavior: 'Create a LoadOffer with status="open", userId=ctx.user. Return it.' },
      { name: 'listMine', kind: 'query', inputZod: 'z.object({}).optional()', behavior: 'Return all LoadOffer docs where userId=ctx.user, newest first.' },
      { name: 'findMatches', kind: 'query', inputZod: 'z.object({ offerId: z.string() })', behavior: 'Load the offer. Find OTHER open offers (different userId) where: originCity matches (case-insensitive substring match either way) AND destinationCity matches AND pickupDate within +/- 2 days AND combined weight <= 5000kg. Return matches with a similarityScore (0-100) computed as: 50 base + 25 if exact origin match + 25 if exact dest match - days-apart penalty. Sort by score desc.' },
      { name: 'cancel', kind: 'mutation', inputZod: 'z.object({ offerId: z.string() })', behavior: 'Set offer status to "cancelled" (only if userId matches ctx.user). Return updated.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), originCity (string), destinationCity (string), weightKg (number), pickupDate (Date), status (string, enum: open/cancelled/matched, default open), notes (string, optional), createdAt (Date, default now)',
  },
  {
    slug: 'live-tracking',
    routerKey: 'tracking',
    model: 'TrackingPing',
    page: 'LiveTracking',
    route: '/live-tracking',
    title: 'Live Tracking & ETA',
    icon: 'map',
    desc: 'Driver posts geolocation pings. System computes ETA to destination using straight-line distance.',
    procedures: [
      { name: 'ping', kind: 'mutation', inputZod: 'z.object({ draftId: z.string(), lat: z.number(), lng: z.number(), speedKmh: z.number().nonnegative().default(40), destinationLat: z.number(), destinationLng: z.number() })', behavior: 'Compute haversine distance from (lat,lng) to (destinationLat,destinationLng). ETA minutes = (distance / max(speedKmh,1)) * 60. Save a TrackingPing doc with all inputs + distanceKm + etaMinutes + userId. Return saved doc.' },
      { name: 'latest', kind: 'query', inputZod: 'z.object({ draftId: z.string() })', behavior: 'Return the most recent TrackingPing for the draftId (any user).' },
      { name: 'history', kind: 'query', inputZod: 'z.object({ draftId: z.string(), limit: z.number().int().positive().max(200).default(50) })', behavior: 'Return last N TrackingPing docs for draftId, oldest first.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), draftId (string, indexed), lat (number), lng (number), speedKmh (number), destinationLat (number), destinationLng (number), distanceKm (number), etaMinutes (number), createdAt (Date, default now, indexed)',
  },
  {
    slug: 'anomaly-detection',
    routerKey: 'anomaly',
    model: 'AnomalyReport',
    page: 'AnomalyDetection',
    route: '/anomaly-detection',
    title: 'AI Anomaly Detection',
    icon: 'alert',
    desc: 'Runs a Gemini analysis on a shipment\'s metadata (weight, count, route, declared vs detected values) to flag suspicious patterns.',
    procedures: [
      { name: 'analyze', kind: 'mutation', inputZod: 'z.object({ draftId: z.string().optional(), declaredWeightKg: z.number().nonnegative(), measuredWeightKg: z.number().nonnegative(), declaredCount: z.number().int().nonnegative(), detectedCount: z.number().int().nonnegative(), originCity: z.string(), destinationCity: z.string(), routeDeviationKm: z.number().nonnegative().default(0), extraNotes: z.string().optional() })', behavior: 'Call Gemini 1.5 Flash with a structured prompt summarizing the inputs and asking for JSON: {"flags": string[], "severity": "low"|"medium"|"high", "riskScore": number (0-100), "summary": string}. Persist AnomalyReport. Return saved doc.' },
      { name: 'history', kind: 'query', inputZod: 'z.object({ limit: z.number().int().positive().max(50).default(20) })', behavior: 'Return last N AnomalyReport docs for ctx.user.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), draftId (string, optional), declaredWeightKg (number), measuredWeightKg (number), declaredCount (number), detectedCount (number), originCity (string), destinationCity (string), routeDeviationKm (number), flags (string[]), severity (string, enum low/medium/high), riskScore (number), summary (string), createdAt (Date, default now)',
  },
  {
    slug: 'rfid-verification',
    routerKey: 'rfid',
    model: 'RfidScanResult',
    page: 'RfidVerification',
    route: '/rfid-verification',
    title: 'RFID/NFC Verification',
    icon: 'tag',
    desc: 'Submit the manifest tag list and the scanned tag list (one tag per line). System returns matched, missing, and extra tags.',
    procedures: [
      { name: 'verify', kind: 'mutation', inputZod: 'z.object({ draftId: z.string().optional(), manifestTags: z.array(z.string().min(1)).min(1), scannedTags: z.array(z.string().min(1)) })', behavior: 'Compute matched = intersection (case-insensitive trim), missing = manifest \\ scanned, extra = scanned \\ manifest. matchPct = matched.length / manifestTags.length * 100. Persist RfidScanResult. Return saved doc.' },
      { name: 'history', kind: 'query', inputZod: 'z.object({ limit: z.number().int().positive().max(50).default(20) })', behavior: 'Return last N RfidScanResult docs for ctx.user.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), draftId (string, optional), manifestTags (string[]), scannedTags (string[]), matched (string[]), missing (string[]), extra (string[]), matchPct (number), createdAt (Date, default now)',
  },
  {
    slug: 'weight-check',
    routerKey: 'weightCheck',
    model: 'WeightCheck',
    page: 'WeightCheck',
    route: '/weight-check',
    title: 'Load Sensor Weight Check',
    icon: 'scale',
    desc: 'Compare a measured load-sensor weight against the declared shipment weight. Flags deviations beyond a configurable threshold.',
    procedures: [
      { name: 'submit', kind: 'mutation', inputZod: 'z.object({ draftId: z.string().optional(), declaredWeightKg: z.number().positive(), measuredWeightKg: z.number().nonnegative(), thresholdPct: z.number().nonnegative().default(5) })', behavior: 'deviationKg = measured - declared. deviationPct = abs(deviationKg) / declared * 100. flagged = deviationPct > thresholdPct. Persist WeightCheck. Return saved doc.' },
      { name: 'history', kind: 'query', inputZod: 'z.object({ limit: z.number().int().positive().max(50).default(20) })', behavior: 'Return last N WeightCheck docs for ctx.user.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), draftId (string, optional), declaredWeightKg (number), measuredWeightKg (number), deviationKg (number), deviationPct (number), thresholdPct (number), flagged (boolean), createdAt (Date, default now)',
  },
  {
    slug: 'fraud-dashboard',
    routerKey: 'fraud',
    model: null,
    page: 'FraudDashboard',
    route: '/fraud-dashboard',
    title: 'Fraud & Risk Dashboard',
    icon: 'shield',
    desc: 'Aggregated risk metrics across all verification events for the current user (box counts, diffs, RFID, weight, anomalies).',
    procedures: [
      { name: 'summary', kind: 'query', inputZod: 'z.object({}).optional()', behavior: 'Query the five models (BoxCountResult, ShipmentDiff, RfidScanResult, WeightCheck, AnomalyReport) filtered by userId=ctx.user. Return aggregates: { boxCountMismatches: number, avgDamageRiskScore: number, totalRfidMissing: number, weightFlagged: number, anomalyHighSeverity: number, recentEvents: Array<{type, riskScore, createdAt, summary}> sorted by createdAt desc, capped at 20 }. If a model file does not exist yet (use dynamic require with try/catch or check via mongoose.models), skip it gracefully and return zeros.' },
    ],
    modelFields: null,
    note: 'No new Mongoose model — this router READS the five models created by other agents. Import them with try/catch or use mongoose.connection.collection() so missing models do not break compile. Safer pattern: import statically (assuming they exist) since all 10 agents run in parallel before integration.',
  },
  {
    slug: 'truck-registry',
    routerKey: 'trucks',
    model: 'Truck',
    page: 'TruckRegistry',
    route: '/truck-registry',
    title: 'Truck Registry',
    icon: 'truck',
    desc: 'Small-truck owners register their truck (plate, capacity, base city). Powers the load aggregation matcher.',
    procedures: [
      { name: 'register', kind: 'mutation', inputZod: 'z.object({ plate: z.string().min(1), capacityKg: z.number().positive(), baseCity: z.string().min(1), driverName: z.string().min(1), phone: z.string().optional() })', behavior: 'Create Truck doc with userId=ctx.user. Return it.' },
      { name: 'list', kind: 'query', inputZod: 'z.object({}).optional()', behavior: 'Return all Truck docs for ctx.user.' },
      { name: 'remove', kind: 'mutation', inputZod: 'z.object({ truckId: z.string() })', behavior: 'Delete the Truck if userId matches ctx.user. Return { ok: true }.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), plate (string), capacityKg (number), baseCity (string), driverName (string), phone (string, optional), createdAt (Date, default now)',
  },
  {
    slug: 'audit-log',
    routerKey: 'audit',
    model: 'AuditEvent',
    page: 'AuditLog',
    route: '/audit-log',
    title: 'Verification Audit Log',
    icon: 'history',
    desc: 'Append-only log of all verification events on a shipment (box count, RFID scan, weight check, anomaly report).',
    procedures: [
      { name: 'append', kind: 'mutation', inputZod: 'z.object({ draftId: z.string(), eventType: z.string().min(1), payload: z.record(z.string(), z.unknown()).optional(), summary: z.string().min(1) })', behavior: 'Create AuditEvent with userId=ctx.user. Return it.' },
      { name: 'forDraft', kind: 'query', inputZod: 'z.object({ draftId: z.string() })', behavior: 'Return all AuditEvent docs for the draftId, oldest first.' },
      { name: 'recent', kind: 'query', inputZod: 'z.object({ limit: z.number().int().positive().max(100).default(30) })', behavior: 'Return last N AuditEvent docs for ctx.user.' },
    ],
    modelFields: 'userId (ObjectId, ref User, indexed), draftId (string, indexed), eventType (string), payload (Mixed), summary (string), createdAt (Date, default now)',
  },
]

function buildFeaturePrompt(f) {
  const modelLine = f.model
    ? `1. backend/src/models/${f.model}.ts — Mongoose model. Fields: ${f.modelFields}. Export both \`export const ${f.model}Model\` and \`export default ${f.model}Model\`. Use mongoose.models.${f.model} || mongoose.model(...) guard to support hot reload.`
    : `1. (no new model file — this feature reads existing models from other agents' work)`

  return `You are building ONE feature for a logistics MVP (3-day demo). Be surgical, fast, and complete.

REPO ROOT: ${REPO}
This is a TypeScript ESM repo.
- Backend: Express + tRPC v11 + Mongoose, NodeNext modules. **ALL relative imports MUST end in .js** (the source is .ts but NodeNext requires .js extensions). Example: \`import { router } from "../trpc.js";\`
- Frontend: React 18 + Vite + Tailwind v4 + tRPC React Query client.

FEATURE: ${f.title}
SLUG: ${f.slug}
ROUTE: ${f.route}
TRPC ROUTER KEY: ${f.routerKey}

WHAT IT DOES: ${f.desc}

═══════════════════════════════════════════════
YOU OWN EXACTLY THESE FILES — NO ONE ELSE TOUCHES THEM:
${modelLine}
2. backend/src/routers/${f.routerKey}.ts — tRPC router exporting \`export const ${f.routerKey}Router\`.
3. frontend/src/pages/${f.slug}/${f.page}.tsx — React page (default export).

🚫 DO NOT TOUCH (a later integration agent owns these):
- backend/src/routers/_app.ts
- backend/src/index.ts
- frontend/src/App.tsx
- frontend/src/pages/dashboard/*
- frontend/src/components/Header.tsx
- any file owned by another feature

═══════════════════════════════════════════════
BACKEND ROUTER SPEC (${f.routerKey}.ts):

Import pattern:
\`\`\`ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose from "mongoose";
import { router, protectedProcedure } from "../trpc.js";
${f.model ? `import { ${f.model}Model } from "../models/${f.model}.js";` : '// import other models you need with .js extensions'}
\`\`\`

Procedures to implement (all use \`protectedProcedure\` unless noted):
${f.procedures.map((p, i) => `  ${i + 1}. \`${p.name}\` (${p.kind}):
       Input: ${p.inputZod}
       Behavior: ${p.behavior}`).join('\n')}

For procedures that call Gemini multimodal: use \`@google/generative-ai\` with \`new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)\` and model "gemini-1.5-flash". Send images as { inlineData: { data: base64, mimeType } }. Wrap the response.text() in a JSON parse with try/catch — if parsing fails, throw TRPCError code "INTERNAL_SERVER_ERROR" with a descriptive message including the raw text snippet.

For ctx.user: use \`const userId = ctx.user.id ?? ctx.user._id;\` (same pattern as backend/src/routers/auth.ts).

${f.note ? `SPECIAL NOTE: ${f.note}` : ''}

═══════════════════════════════════════════════
FRONTEND PAGE SPEC (${f.page}.tsx):

Skeleton:
\`\`\`tsx
import { useState } from "react";
import Header from "../../components/Header";
import { trpc } from "../../lib/trpc";

export default function ${f.page}() {
  // local state for inputs
  // trpc.${f.routerKey}.<procedure>.useMutation() for mutations
  // trpc.${f.routerKey}.<procedure>.useQuery() for queries
  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)]">
      <Header title="${f.title}" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* form + results */}
      </main>
    </div>
  );
}
\`\`\`

The page must:
- Provide form inputs for every parameter of the primary mutation
- For image inputs: render a file input, read with FileReader.readAsDataURL, strip the "data:...;base64," prefix before sending
- Call the primary mutation on submit, show loading + error + success states
- For history queries: render results in a card/list
- Use Tailwind classes consistent with sibling pages (look at frontend/src/pages/news/News.tsx for layout examples)
- Use \`import { toast } from "react-toastify"\` for user-facing errors (this dependency exists)

═══════════════════════════════════════════════
PATTERNS TO STUDY FIRST (read these before writing — they encode the conventions):
- backend/src/routers/auth.ts — protectedProcedure + ctx.user pattern
- backend/src/routers/inventory.ts — model usage + queries
- backend/src/models/Draft.ts — Mongoose model shape
- backend/src/legacy/compliance.ts — Gemini multimodal API call pattern
- frontend/src/pages/news/News.tsx — page layout
- frontend/src/components/Header.tsx — Header import path & props
- frontend/src/lib/trpc.ts — trpc client import path

═══════════════════════════════════════════════
ACCEPTANCE CRITERIA:
- Files exist at the exact paths listed.
- \`cd backend && npx tsc --noEmit\` must succeed on YOUR files (you cannot test the full build because integration files don't reference your router yet).
- All relative backend imports end in .js.
- All exports use the names specified above (\`${f.routerKey}Router\`, ${f.model ? `\`${f.model}Model\`,` : ''} default export for page).
- No TODO comments — write real working logic. For Gemini calls, write the actual prompt and parse the actual response.

When done, respond with ONLY the list of file paths you created or modified, one per line, absolute paths. No prose.`
}

function buildIntegrationPrompt(features) {
  const featureList = features.map(f => `  - ${f.slug}: routerKey=${f.routerKey}, route=${f.route}, page=${f.page}, title="${f.title}", desc="${f.desc}"`).join('\n')
  return `You are the integration agent. Ten parallel agents have just finished creating 10 isolated feature files. Now wire them all together.

REPO ROOT: ${REPO}

FEATURES TO WIRE UP:
${featureList}

═══════════════════════════════════════════════
EDITS YOU MUST MAKE:

1. backend/src/routers/_app.ts
   - Import each new router from "./<routerKey>.js" (NodeNext requires .js).
   - Add each routerKey to the appRouter object literal.
   - Keep existing entries (auth, inventory, compliance, logistics).

2. frontend/src/App.tsx
   - Import each new page from "./pages/<slug>/<Page>".
   - Add a <Route path="<route>" element={<Page />} /> INSIDE the existing <Route element={<ProtectedRoute />}> block.
   - Keep all existing routes.

3. frontend/src/pages/dashboard/Dashboard.tsx
   - Find where existing feature navigations live (look for navigate("/compliance"), navigate("/inventory-management") etc).
   - For each new feature, add a clearly visible navigation card / button that calls navigate("<route>") and shows the feature title + description.
   - Use a consistent visual style with the existing nav cards. If the existing dashboard uses a "FeatureCarousel" or a grid of feature buttons, add the new ones into that same data structure or grid.
   - The user must be able to reach every new feature from the dashboard. This is critical.

4. frontend/src/components/Header.tsx (optional but preferred)
   - If there is a navigation menu in the header (look for nav links to /dashboard, /inventory-management, etc), add quick links to the most important new features (box-count, shipment-diff, fraud-dashboard, live-tracking, load-aggregation). Skip this step if the header has no nav menu.

═══════════════════════════════════════════════
RULES:
- DO NOT modify any feature router file (backend/src/routers/<feature>.ts), model file, or page file. The other agents own those.
- Read the existing files first with the Read tool before editing. Match the existing import style and formatting.
- Backend relative imports must end in .js.
- Preserve existing routes, existing dashboard nav, existing imports.

ACCEPTANCE:
- All 10 new routers are registered in _app.ts.
- All 10 new routes exist in App.tsx inside ProtectedRoute.
- All 10 features have a clickable nav target from Dashboard.tsx.
- \`cd backend && npx tsc --noEmit\` exits 0.
- \`cd frontend && npx tsc --noEmit\` exits 0.

After editing, RUN both typechecks yourself and report the result. If either fails, fix the errors caused by your integration edits (do not modify feature files — if a feature file has a type error, report it instead).

Respond with the list of files you modified, then a short status line: "BACKEND_TSC: ok|fail" and "FRONTEND_TSC: ok|fail" and any error excerpts.`
}

function buildValidatorPrompt() {
  return `Run typechecks and lint. Report structured results.

REPO ROOT: ${REPO}

Run these commands and capture output:
1. \`cd ${REPO}/backend && npx tsc --noEmit\` (use 5min timeout)
2. \`cd ${REPO}/frontend && npx tsc --noEmit\` (use 5min timeout)
3. \`cd ${REPO}/frontend && npm run lint\` (use 5min timeout, only block on errors not warnings)

For each command:
- If exit 0: ok
- Else: capture the error lines (the lines that name a file + error code)

Return ONLY the structured JSON via the StructuredOutput tool.`
}

const VALIDATOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['backendOk', 'frontendOk', 'lintOk', 'backendErrors', 'frontendErrors', 'lintErrors'],
  properties: {
    backendOk: { type: 'boolean' },
    frontendOk: { type: 'boolean' },
    lintOk: { type: 'boolean' },
    backendErrors: { type: 'array', items: { type: 'string' } },
    frontendErrors: { type: 'array', items: { type: 'string' } },
    lintErrors: { type: 'array', items: { type: 'string' } },
  },
}

function buildFixerPrompt(errors) {
  return `You are the fixer. Earlier phases built and integrated 10 features. Typechecks now report these errors. Fix them surgically.

REPO ROOT: ${REPO}

BACKEND TSC ERRORS (${errors.backendErrors.length}):
${errors.backendErrors.slice(0, 50).join('\n') || '(none)'}

FRONTEND TSC ERRORS (${errors.frontendErrors.length}):
${errors.frontendErrors.slice(0, 50).join('\n') || '(none)'}

LINT ERRORS (${errors.lintErrors.length}):
${errors.lintErrors.slice(0, 50).join('\n') || '(none)'}

RULES:
- Edit only the files that have errors.
- Do NOT comment out errors with @ts-ignore or @ts-expect-error unless absolutely no other fix exists.
- Do NOT remove functionality. Preserve the intent.
- Backend relative imports must end in .js.
- After fixing, re-run \`cd ${REPO}/backend && npx tsc --noEmit\` and \`cd ${REPO}/frontend && npx tsc --noEmit\` and report final status.

If you cannot fix an error without breaking functionality, report it and leave it. Don't break working features to silence errors.

Respond with: list of files you edited, then "BACKEND_TSC_FINAL: ok|fail" and "FRONTEND_TSC_FINAL: ok|fail".`
}

phase('Build features')
const buildResults = await parallel(FEATURES.map(f => () => agent(buildFeaturePrompt(f), {
  label: f.slug,
  phase: 'Build features',
  model: 'sonnet',
})))

log(`Build phase complete: ${buildResults.filter(Boolean).length}/${FEATURES.length} features delivered`)

phase('Integrate')
const integrationResult = await agent(buildIntegrationPrompt(FEATURES), {
  label: 'integrate-routes-nav',
  phase: 'Integrate',
  model: 'sonnet',
})

phase('Validate')
const errors = await agent(buildValidatorPrompt(), {
  label: 'tsc-and-lint',
  phase: 'Validate',
  model: 'sonnet',
  schema: VALIDATOR_SCHEMA,
})

let fixResult = null
if (!errors.backendOk || !errors.frontendOk) {
  phase('Fix errors')
  fixResult = await agent(buildFixerPrompt(errors), {
    label: 'fix-tsc-errors',
    phase: 'Fix errors',
    model: 'sonnet',
  })
}

return {
  features: FEATURES.map(f => ({ slug: f.slug, route: f.route, routerKey: f.routerKey })),
  buildSummaries: buildResults,
  integrationSummary: integrationResult,
  validation: errors,
  fixSummary: fixResult,
}
