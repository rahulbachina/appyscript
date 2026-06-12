---
title: Guardrail Layer
nav_order: 4
parent: Applaa Home
---

# Applaa Home — GuardrailLayer

Every device command in Applaa Home passes through `checkCommand()` in
`src/main/home/guardrail.ts` before any driver receives it. Neither the AI
(Appy), the renderer, nor automations can bypass this layer — they can only
request. This document describes the tier model, the audit log, rate limiting,
and the PIN flow for developers integrating home-control features.

---

## Tier Model

Each device stored in the `home_devices` table has a `tier` integer (1–3).
The tier determines who can control it and under what conditions.

| Tier | Name | Who controls it | Guardrail behaviour |
|------|------|-----------------|---------------------|
| 1 | Play | kid, parent, appy, automation | Allowed after rate-limit check. Default for Hue lights imported via `home:sync-devices`. |
| 2 | Supervised | parent, appy (no automation, no unapproved kid) | Automations are hard-blocked. Kid access requires a per-device parent grant (Phase 2 — denied in Phase 1). |
| 3 | Restricted | parent only, fresh PIN per action | Denied for every non-parent source. A valid parent PIN must accompany every `set_state` call. |

Reads (`read_state`) are allowed for any source regardless of tier, subject
only to the device existing in the DB.

---

## GuardrailLayer Architecture

```
Renderer / Appy / Automation
          │
          │  home:command IPC  (raw payload, any shape)
          ▼
  smart_home_handlers.ts
          │
          ▼
  checkCommand(raw)  ←  src/main/home/guardrail.ts
    │
    ├─ 1. Schema validation (Zod — HomeCommandSchema)
    ├─ 2. Device existence check (home_devices DB)
    ├─ 3. read_state fast-path (always allow, audit, return)
    ├─ 4. Tier enforcement
    │      ├─ tier 3: source must be 'parent' + valid PIN
    │      ├─ tier 2: automations blocked; kid blocked (Phase 1)
    │      └─ tier 1: pass through
    ├─ 5. Rate limit (non-parent sources)
    └─ 6. Audit write
          │
          ▼  verdict: { allowed, reason?, device? }
  Driver (hue.ts, …)  — only executes if allowed === true
```

### HomeCommandSchema (Zod)

Defined in `guardrail.ts` and exported for test use:

```ts
const HomeCommandSchema = z.object({
  deviceId:  z.string().min(1),
  action:    z.enum(["set_state", "read_state"]),
  params: z.object({
    on:         z.boolean().optional(),
    brightness: z.number().min(0).max(100).optional(),  // percent
    color:      z.string().optional(),                   // "red" | "#ff0000"
  }).default({}),
  source: z.enum(["kid", "parent", "appy", "automation"]),
  pin:    z.string().optional(),  // required for tier 3
});
```

Any payload that fails Zod parse is rejected immediately — the rejection is
logged but **not** written to the audit log (no device ID to attribute it to).

### GuardrailVerdict

```ts
interface GuardrailVerdict {
  allowed: boolean;
  reason?: string;          // human-readable denial reason (shown in UI)
  device?: {
    id: string; driver: string; name: string;
    kind: string; tier: number; configJson: string | null;
  };
}
```

Drivers receive the verdict and must check `allowed === true` before touching
hardware. The `device` field carries the DB row so the handler does not need a
second DB lookup.

---

## Audit Log

Every call to `checkCommand()` that passes schema validation writes one row to
`homeAuditLog` (via Drizzle ORM). The write is fire-and-forget — a failure is
warned but does not block the command.

### Schema (relevant columns)

| Column | Type | Notes |
|--------|------|-------|
| `deviceId` | text | The resolved DB device ID |
| `action` | text | `set_state` or `read_state` |
| `paramsJson` | text | JSON-serialised params |
| `source` | text | `kid` / `parent` / `appy` / `automation` |
| `allowed` | boolean | Whether the command was permitted |
| `reason` | text | Denial reason, `null` if allowed |
| `createdAt` | datetime | Auto-set by DB default |

### Querying the audit log

Parents retrieve recent entries via the `home:audit-log` IPC channel (see
API Reference). The handler caps results at 200 rows regardless of the
`limit` parameter passed by the renderer.

---

## Rate Limiting

Applies to every source except `parent`. The limit is **10 commands per minute
per device** and is enforced in main-process memory (not persisted across
restarts).

```
rateBuckets: Map<deviceId, timestamp[]>
```

On each call the bucket is filtered to keep only timestamps within the last
60 seconds. If the filtered length is already 10 the command is denied and
audited with reason `"rate limit"`. Otherwise the current timestamp is appended.

A parent-sourced command (`source: "parent"`) **always** bypasses the rate
limiter so parents can intervene freely.

---

## Parent PIN Flow (Tier 3)

### Setting a PIN

The parent PIN is stored as a scrypt hash in a single-row `parent_pin` table:

```
pinHash = scrypt(pin, salt, 32).toString('hex')
stored  = "<saltHex>:<hashHex>"
```

The PIN UI (parent settings) calls a `parent:set-pin` handler that performs the
hashing in main process. The raw PIN never touches the renderer after the form
submission.

### Verification at command time

`verifyParentPin(pin)` in `guardrail.ts`:

1. Reads the single row from `parent_pin`.
2. Splits `pin_hash` on `:` to recover salt and expected hash.
3. Derives `scrypt(attempt, salt, 32)` and compares with `timingSafeEqual`.
4. Returns `false` if no PIN row exists (tier 3 actions are therefore impossible
   until a parent sets a PIN).

### IPC contract for tier 3 actions

The renderer must include `pin` in the `home:command` payload:

```ts
await window.electron.invoke("home:command", {
  deviceId: "hue-light-5",
  action:   "set_state",
  params:   { on: true },
  source:   "parent",
  pin:      "<PIN entered by parent in a modal>",
});
```

The PIN field is **never** cached or stored in renderer state. The parent must
re-enter it for every tier 3 action. There is no session token.

---

## Adding a New Tier 2 Grant Flow (Future)

Phase 1 hard-blocks all kid access to tier 2 devices. When the grant flow
ships (cameras, Phase 2), the expected pattern is:

1. A `homeDeviceGrants` DB table stores `(deviceId, grantedBy, expiresAt)`.
2. `checkCommand()` looks up a valid grant for `source === 'kid'` before
   applying the tier 2 block.
3. The parent grant UI invokes a new `home:grant-device` IPC channel.

No changes to existing guardrail logic are required for Tier 1 devices.

---

## Safety Invariants — Reference

These are encoded in code, not configuration. They cannot be disabled at
runtime:

1. **Schema gate** — malformed commands are rejected before any DB or driver
   code runs.
2. **Tier 3 PIN** — the check is synchronous scrypt; there is no async path
   that could skip it.
3. **Universal audit** — the `audit()` call appears on every code path that
   returns a verdict after a device is found.
4. **Rate limit** — applied before the `audit(cmd, true)` success path, so
   rate-limited commands are always audited as denied.
5. **Credential isolation** — `hueBridgeIp` and `hueUsername` are read inside
   `smart_home_handlers.ts` (main process) and never serialised into any IPC
   response sent to the renderer.
