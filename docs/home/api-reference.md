---
title: IPC API Reference
nav_order: 6
parent: Applaa Home
---

# Applaa Home — IPC API Reference

All home IPC channels are registered in
`src/ipc/handlers/smart_home_handlers.ts` via
`registerSmartHomeHandlers()`. They are called from the renderer using
`window.electron.invoke(channel, payload)`.

Credentials (Hue bridge IP, API username) are **never** returned to the
renderer. They are read from main-process settings inside each handler.

---

## Channel Index

| # | Channel | Purpose |
|---|---------|----------|
| 1 | `home:discover` | Find Hue bridges on the LAN |
| 2 | `home:pair` | Pair with a bridge via link button |
| 3 | `home:sync-devices` | Import bridge lights into home_devices DB |
| 4 | `home:devices` | List configured devices with live state |
| 5 | `home:command` | Execute a single device command (through GuardrailLayer) |
| 6 | `home:run-appyscript` | Compile and run an AppyScript home program |
| 7 | `home:audit-log` | Retrieve recent command audit entries |

---

## 1. `home:discover`

Finds Philips Hue bridges on the local network by querying
`https://discovery.meethue.com`. No parameters required.

### Parameters

None.

### Returns

```ts
{
  bridges: Array<{
    id: string;                // Bridge hardware ID (hex string)
    internalipaddress: string; // Local IP, e.g. "192.168.1.12"
  }>;
}
```

`bridges` is an empty array if no bridges are found or if the discovery
endpoint is unreachable (e.g. no internet access).

### Example

```ts
const { bridges } = await window.electron.invoke("home:discover");
// [ { id: "001788fffe123456", internalipaddress: "192.168.1.12" } ]
```

---

## 2. `home:pair`

Pairs with a Hue bridge. The user must press the physical link button on the
bridge before this is called (Signify API constraint).

### Parameters

```ts
{ bridgeIp: string }  // IP returned by home:discover, or manually entered
```

### Returns

```ts
{ ok: true } | { ok: false; error: string }
```

On success, `hueBridgeIp` and `hueUsername` are written to main-process
settings. On failure, `error` is a user-readable string.

### Error strings

| Error | Meaning |
|-------|---------|
| `"Press the round button on your Hue bridge, then try again within 30 seconds."` | Bridge returned error type 101 (link button not pressed) |
| `"Could not reach the bridge at <ip>."` | Network timeout or wrong IP |
| Other strings | Bridge-returned error descriptions |

### Example

```ts
const result = await window.electron.invoke("home:pair", {
  bridgeIp: "192.168.1.12",
});
if (!result.ok) showError(result.error);
```

---

## 3. `home:sync-devices`

Fetches all lights from the paired bridge and upserts them into the
`home_devices` SQLite table. Safe to call multiple times — existing devices
are updated (name only), new ones are inserted. Newly synced lights default
to **Tier 1**.

### Parameters

None.

### Returns

```ts
{ ok: true; count: number }         // count = number of lights found
| { ok: false; error: string }       // e.g. "No Hue bridge paired yet."
```

### Side effects

- Inserts/updates rows in `home_devices` with IDs of the form `"hue-light-<hueId>"`.
- Does not delete devices that were removed from the bridge. Re-sync to refresh names.

### Example

```ts
const { ok, count } = await window.electron.invoke("home:sync-devices");
// { ok: true, count: 4 }
```

---

## 4. `home:devices`

Returns all devices from the local DB, with live state attached for Hue
lights (one bridge fetch per call).

### Parameters

None.

### Returns

```ts
{
  paired: boolean;
  devices: Array<{
    id:     string;          // e.g. "hue-light-3"
    driver: string;          // e.g. "hue"
    name:   string;          // human-readable, e.g. "Bedroom 1"
    room:   string | null;   // optional room assignment
    kind:   string;          // e.g. "light"
    tier:   number;          // 1 | 2 | 3
    state:  {
      on:         boolean;
      brightness: number;    // 0–100 %
      reachable:  boolean;
    } | null;                // null if bridge unreachable
  }>;
}
```

`paired` is `false` if no bridge credentials are stored; `state` is `null`
per device if the bridge fetch fails.

### Example

```ts
const { devices, paired } = await window.electron.invoke("home:devices");
const lights = devices.filter(d => d.kind === "light");
```

---

## 5. `home:command`

Executes a single device command. Every call passes through
`checkCommand()` in the GuardrailLayer — see
[guardrails.md](guardrails.md) for tier/rate-limit/PIN details.

### Parameters

```ts
{
  deviceId:  string;                                          // DB device ID
  action:    "set_state" | "read_state";
  params?: {
    on?:         boolean;
    brightness?: number;    // 0–100
    color?:      string;    // "red" | "#rrggbb"
  };
  source:    "kid" | "parent" | "appy" | "automation";
  pin?:      string;        // required when source="parent" + tier 3 device
}
```

### Returns

For `set_state`:

```ts
{ ok: true } | { ok: false; error: string }
```

For `read_state`:

```ts
{ ok: true; state: { on: boolean; brightness: number; reachable: boolean } | null }
| { ok: false; error: string }
```

### Denial reasons (error strings)

| Error | Guardrail rule |
|-------|----------------|
| `"invalid command: <field>"` | Schema validation failed |
| `"I don't know that device."` | Device ID not in DB |
| `"Only a parent can control this device."` | Tier 3, non-parent source |
| `"Parent PIN required."` | Tier 3, missing or wrong PIN |
| `"Automations can only use Play-tier devices."` | Tier 2, automation source |
| `"Ask a parent to unlock this device for you."` | Tier 2, kid source (Phase 1) |
| `"Whoa — too many commands! Wait a minute and try again."` | Rate limit exceeded |
| `"Hue bridge not paired."` | Bridge credentials not set |
| `"Driver '<name>' not supported yet."` | Driver not implemented |

### Example — set colour

```ts
const result = await window.electron.invoke("home:command", {
  deviceId: "hue-light-2",
  action:   "set_state",
  params:   { color: "blue", brightness: 80 },
  source:   "kid",
});
```

### Example — tier 3 with PIN

```ts
const result = await window.electron.invoke("home:command", {
  deviceId: "hue-light-5",
  action:   "set_state",
  params:   { on: false },
  source:   "parent",
  pin:      parentPinFromModal,
});
```

---

## 6. `home:run-appyscript`

Compiles an AppyScript source string (home target) and executes the resulting
commands through the GuardrailLayer. This is the channel called by
AppyTutorPanel when the user taps "Run on my lights".

Compilation happens in main process. The renderer passes raw source text only.

### Parameters

```ts
{
  source:        string;                                       // AppyScript source
  source_origin?: "kid" | "parent" | "appy" | "automation";  // default: "appy"
}
```

### Returns

```ts
{
  ok:            boolean;     // true if compile succeeded and no errors
  executed:      number;      // commands that passed guardrail + driver OK
  denied:        number;      // commands blocked by guardrail
  notifications: string[];    // say() statements from the AppyScript program
  errors:        string[];    // compile errors or unknown-device errors
}
```

`ok` is `false` if there are any `errors`; it may be `true` even when
`denied > 0` (denial is a guardrail event, not an error).

### Compile error vs denial

| Condition | Field set |
|-----------|----------|
| AppyScript syntax error | `errors[]`, `ok: false` |
| Device name not in DB | `errors[]` ("Unknown device: …") |
| GuardrailLayer denied | `denied++`; audited; no error entry |
| Driver failure | `errors[]` (device-level error) |

### Example

```ts
const result = await window.electron.invoke("home:run-appyscript", {
  source: `when start\n  set bedroom_1 to "blue"\nend`,
  source_origin: "kid",
});
console.log(`executed: ${result.executed}, denied: ${result.denied}`);
// notifications: result.notifications
```

---

## 7. `home:audit-log`

Returns recent home command audit entries in reverse-chronological order.
Intended for the parent dashboard. Results are capped at 200 regardless of
the requested limit.

### Parameters

```ts
{ limit?: number }  // default 50, max 200
```

### Returns

```ts
{
  entries: Array<{
    id:         number;
    deviceId:   string;
    action:     string;          // "set_state" | "read_state"
    paramsJson: string;          // JSON string of params
    source:     string;          // "kid" | "parent" | "appy" | "automation"
    allowed:    boolean;
    reason:     string | null;   // denial reason, null if allowed
    createdAt:  string;          // ISO 8601 datetime
  }>;
}
```

### Example

```ts
const { entries } = await window.electron.invoke("home:audit-log", { limit: 20 });
const denials = entries.filter(e => !e.allowed);
```

---

## Type Summary

```ts
// Shared across channels — defined in guardrail.ts
type HomeCommandSource = "kid" | "parent" | "appy" | "automation";

// From appyscript-runner.ts
interface RunResult {
  ok:            boolean;
  executed:      number;
  denied:        number;
  notifications: string[];
  errors:        string[];
}

// From hue.ts
interface HueBridge {
  id:                 string;
  internalipaddress:  string;
}
```
