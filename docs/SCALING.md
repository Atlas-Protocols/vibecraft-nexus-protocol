# Scaling the Nexus Relay

## Current setup (what's deployed)

```
wss://vibecraft-nexus-relay.fly.dev
```

- Single Fly.io machine in IAD (Washington DC)
- `min_machines_running = 1` — always on, never sleeps
- In-memory routing — no persistence, pure forward-only pipe
- Good for: small teams (2-10 agents), development, experimentation

---

## When to run your own relay

| Situation | Solution |
|-----------|----------|
| Privacy — don't want metadata on a shared relay | Self-host |
| Low latency — far from IAD | Deploy relay closer to you |
| Air-gapped network | Local relay (`npx tsx agents/nexus-relay.ts`) |
| High volume (100+ connected agents) | Multi-relay with shared state |

---

## Self-hosting (2 minutes)

**Fly.io (recommended):**
```bash
# In the repo root
flyctl apps create your-relay-name
flyctl deploy

# Agents connect to:
wss://your-relay-name.fly.dev
```

**Docker anywhere:**
```bash
docker build -t nexus-relay .
docker run -d \
  -p 443:8080 \
  -e PORT=8080 \
  --name nexus-relay \
  nexus-relay

# Agents connect to:
wss://your-server-ip  # if TLS terminated by nginx/caddy
ws://your-server-ip:4020  # if running raw
```

**Local (same network only):**
```bash
npx tsx agents/nexus-relay.ts
# or with custom port:
NEXUS_RELAY_PORT=9000 npx tsx agents/nexus-relay.ts

# Agents connect to:
ws://your-local-ip:4020
```

---

## Scaling beyond one relay (multi-node)

The current relay is stateful in-memory — a DID registered on relay-A isn't visible to relay-B.

For multi-relay setups, you need shared state between relay instances:

**Option 1: Redis pub/sub backbone**
```
Agent → Relay-A → Redis → Relay-B → Agent
```
Each relay subscribes to all DID channels. When a message arrives for a DID not registered locally, relay queries Redis for which node holds it and forwards.

**Option 2: Relay mesh (peer relays)**
Relays announce to each other like agents do — using Nexus Protocol itself. A relay that doesn't have the target DID forwards to a peer relay that does.

**Option 3: Just run more independent relays**
Different teams use different relay URLs. Simple, no coordination needed, minor inconvenience of knowing which relay a peer is on.

For most use cases, a single relay handles thousands of concurrent WebSocket connections comfortably. Fly.io will auto-scale machines if you configure `auto_stop_machines = false` and `min_machines_running > 1`.

---

## Production checklist

- [ ] `min_machines_running = 1` in fly.toml (prevents cold starts)
- [ ] `auto_stop_machines = false` (relay must stay alive)
- [ ] Deploy in a region close to your team (`fly regions list`)
- [ ] Set up `flyctl logs --app your-relay` alerts for errors
- [ ] Add `NEXUS_RELAY_PORT` env var if running behind a reverse proxy on a non-8080 port
- [ ] Consider rate limiting per DID for public relays (not implemented in current relay — good first PR)

---

## Architecture note: why the relay is a dumb pipe

The relay intentionally does nothing except route. It:
- Does NOT verify Ed25519 signatures
- Does NOT decrypt or inspect payload content
- Does NOT store messages
- Does NOT make trust decisions

This is deliberate. Verification happens at the receiver. The relay being dumb means:
- It's cheap to run (no crypto overhead per message)
- It can be replaced / self-hosted trivially
- A compromised relay cannot forge messages (no private keys, no HMAC secrets)
- Multiple relays can coexist — they're interchangeable

The security model lives entirely in `nexus-protocol/nexus.ts`, not in the relay.
