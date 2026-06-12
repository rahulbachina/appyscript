---
title: Integration Guide
nav_order: 5
parent: Applaa Home
---

# Applaa Home — Integration Guide

This guide walks through the complete setup path: pairing a Philips Hue bridge,
syncing devices into the Applaa DB, writing AppyScript to control them, and
running that code from the Appy chat panel. Follow the steps in order.

---

## Prerequisites

- Applaa Builder installed and running (Electron desktop app).
- A Philips Hue bridge (v2 square or v1 round) on the same LAN as the device
  running Applaa.
- The `appyscript` npm package present in the Builder's dependencies
  (`package.json` already lists it; run `npm install` if you are working from
  source).
- Physical access to the Hue bridge (you need to press the round link button).

---

## Step 1 — Discover the Bridge

Applaa uses `https://discovery.meethue.com` to find bridges on the local
network. This is a Signify-hosted endpoint that returns the local IP addresses
of bridges that have checked in.

**In the UI:** Open Applaa Home settings. The screen shows a "Find my bridge"
button.

**Screenshot guidance:** The settings panel shows a list area headed
"Hue Bridges on this network". When no bridge has been paired yet the list is
empty and the button reads "Search for bridges".

**What happens internally:**

```
Renderer → home:discover IPC
  Main process: hue.discoverBridges()
  → GET https://discovery.meethue.com/
  ← [ { id: "...", internalipaddress: "192.168.x.x" } ]
IPC response: { bridges: HueBridge[] }
```

If the bridge does not appear (firewall, mDNS blocked, or bridge not
cloud-registered), enter the IP manually. The bridge IP can be found in your
router's DHCP client table — the hostname usually contains "Philips-hue" or
"BSB002".

---

## Step 2 — Pair the Bridge (Link Button)

1. In the Applaa UI, select a bridge from the discovered list (or type an IP).
2. **Press the round physical button on top of the Hue bridge.** You have 30
   seconds.
3. Click "Pair" in Applaa within those 30 seconds.

**Screenshot guidance:** After pressing Pair, a spinner appears with the text
"Waiting for bridge…". On success it changes to a green tick and the bridge IP
is shown. On failure (button not pressed in time) an amber banner reads "Press
the round button on your Hue bridge, then try again within 30 seconds."

**What happens internally:**

```
Renderer → home:pair IPC  { bridgeIp: "192.168.1.x" }
  Main process: hue.pairBridge(bridgeIp)
  → POST http://<bridgeIp>/api  { devicetype: "applaa_home#desktop" }
  On Hue error type 101: returns { ok: false, error: "Press the button..." }
  On success: writeSettings({ homeSettings: { hueBridgeIp, hueUsername } })
IPC response: { ok: true } | { ok: false, error: string }
```

The bridge "username" (the Hue API token) is written to main-process settings
only. It is never returned to the renderer.

**Troubleshooting:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Could not reach the bridge" | Wrong IP or bridge offline | Confirm IP in router DHCP table |
| Error type 101 in logs | Link button not pressed in time | Press button again and retry |
| Error type 1 (`unauthorised`) | Username already registered but invalid | Factory-reset bridge pairing from Hue app |

---

## Step 3 — Sync Devices

Once paired, import the bridge's lights into the Applaa `home_devices` table.

**In the UI:** A "Sync lights" button appears after successful pairing.

**Screenshot guidance:** The panel shows a count badge "0 devices" before sync.
After sync it updates to e.g. "4 lights synced" and each light appears as a
card with its name from the Hue app (e.g. "Bedroom 1", "Kitchen Ceiling").

**What happens internally:**

```
Renderer → home:sync-devices IPC
  Main process:
    hue.listLights(bridgeIp, username)
    → GET http://<bridgeIp>/api/<username>/lights
    For each light:
      INSERT OR UPDATE home_devices
        id     = "hue-light-<hueId>"
        driver = "hue"
        kind   = "light"
        tier   = 1          ← Play tier by default
        configJson = { hueId }
IPC response: { ok: true, count: 4 }
```

All synced lights start at **Tier 1** (Play). A parent can promote individual
devices to Tier 2 or 3 in the device settings panel.

**Device naming for AppyScript:**

The runner resolves AppyScript variable names to DB IDs via slug matching.
The slug of a device name is: `name.toLowerCase().replace(/\s+/g, '_')
.replace(/[^a-z0-9_]/g, '')`.

Examples:

| Hue name | AppyScript name |
|----------|-----------------|
| `Bedroom 1` | `bedroom_1` |
| `Kitchen Ceiling` | `kitchen_ceiling` |
| `Living Room` | `living_room` |

Rename lights in the Hue app (or via the device settings panel) to give them
short, descriptive names that kids can use naturally.

---

## Step 4 — Write AppyScript to Control Devices

AppyScript is a robotic programming language that compiles to a `HomeProgram`
JSON structure. The `home` compile target is selected automatically when the
code reaches `runAppyScriptHome()`.

### Basic syntax

```appyscript
when start
  set bedroom_1 to "blue"     -- named colour
  set kitchen_ceiling to 80   -- brightness 0-100 %
  set living_room to "on"     -- or "off"
  set bedroom_1 to "#ff4500"  -- hex colour
  say 'Lights updated!'
end
```

### Supported values

| Value type | Example | Notes |
|------------|---------|-------|
| Named colour | `"red"`, `"blue"`, `"purple"` | Mapped to Hue hue/sat in `hue.ts` (`COLOR_MAP`) |
| Hex colour | `"#ff4500"` | Converted to Hue hue/sat via RGB→HSV math |
| Brightness | `75` (integer) | 0 = off, 1–100 = dim–full |
| On/Off | `"on"` / `"off"` | Boolean toggle |

### The compiled HomeProgram structure

The `appyscript` compiler (npm package) outputs JSON:

```json
{
  "immediate": [
    { "device": "bedroom_1", "action": "set_state",
      "params": { "color": "blue" } }
  ],
  "notifications": [
    { "text": "Lights updated!" }
  ],
  "automations": []
}
```

The `appyscript-runner.ts` iterates `immediate`, resolves each device name to a
DB ID, and sends each resolved command through `checkCommand()`. Automations
are logged but not yet executed (Phase 3).

---

## Step 5 — Run AppyScript from Appy Chat

### How Appy generates home code

When the Appy system prompt includes a `buildHomeContext()` block
(`src/lib/appyBrain.ts`), Appy knows:

- Which devices are available (by slug name).
- The AppyScript home syntax.
- To wrap code in `[home:run]` so the panel can render a Run button.

Example Appy response:

```
Sure! Here's the AppyScript to set your bedroom blue:

```appyscript
when start
  set bedroom_1 to "blue"
end
```
[home:run]
```

### How AppyTutorPanel handles [home:run]

`parseHomeRun()` in `src/data/applaaKnowledgeGraph.ts` strips the marker from
display text and signals the panel to show an amber **"Run on my lights"**
button beneath the code block.

**Screenshot guidance:** The chat bubble shows the AppyScript block with syntax
highlighting. Below it an amber rounded button labelled "Run on my lights"
appears. Tapping it shows a brief spinner, then a green toast: "2 lights
updated" (or an amber toast if a command was denied).

### What the button does

```
User taps "Run on my lights"
  Renderer: extracts AppyScript source from the message
  → home:run-appyscript IPC  { source: "...", source_origin: "kid" }
  Main process: runAppyScriptHome(source, "kid")
    1. compile(source, "home")      ← appyscript npm package
    2. JSON.parse(compiled.code)    ← HomeProgram
    3. For each immediate command:
       a. resolveDeviceId(cmd.device)  ← slug/room/id matching
       b. checkCommand({ deviceId, action, params, source: "kid" })
       c. If allowed: hue.setLightState(...)
IPC response: RunResult { ok, executed, denied, notifications, errors }
```

### Source origins

The `source_origin` passed to `home:run-appyscript` determines tier and
rate-limit behaviour:

| Origin | Typical caller | Tier 2 access | Rate limit |
|--------|---------------|---------------|------------|
| `kid` | Run button pressed by child user | Blocked (Phase 1) | Yes, 10/min/device |
| `parent` | Parent-initiated run | Allowed | No |
| `appy` | Appy AI direct invocation | Tier 1 only | Yes |
| `automation` | AutomationEngine (Phase 3) | Blocked | Yes |

---

## Step 6 — Verify in the Audit Log

Every command (allowed or denied) is recorded. Parents can view the log:

**In the UI:** Parent Dashboard → Home Activity.

**Screenshot guidance:** A table with columns Date/Time, Device, Action,
Source, and Status (green "Allowed" / red "Denied"). Denied rows show the
reason in a tooltip on hover (e.g. "rate limit", "Only a parent can control
this device.").

**IPC:** `home:audit-log` returns up to 50 entries by default, 200 max.

---

## Troubleshooting Quick Reference

| Problem | Where to look | Fix |
|---------|---------------|-----|
| Appy does not show "Run on my lights" button | No devices in `home_devices` | Complete Step 3 (sync) |
| "Unknown device: bedroom_1" in RunResult | Device name slug mismatch | Check DB name vs AppyScript name |
| Command denied — "rate limit" | Audit log | Wait 60 s, or use `source: "parent"` |
| Command denied — "Only a parent can control this device" | Device tier | Lower tier in device settings or use parent source |
| Bridge unreachable after router restart | DHCP lease changed | Re-discover bridge; re-pair if IP changed |
| Automation block in logs | Expected behaviour | Phase 3 AutomationEngine not yet active |
