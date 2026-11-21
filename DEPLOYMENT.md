# UniversalCast — Production & SFU Deployment Guide

UniversalCast uses a split architecture:
- **Client SPA (`dist/`)**: React + Vite + `mediasoup-client` `Device` + Firebase Auth + Cloud Firestore metadata.
- **Signaling & Session API (`server.ts` / `dist-server/server.js`)**: Express REST API + WebSocket (`/ws`) coordinator enforcing Firebase ID Token host verification, HMAC receiver tokens, rate limits, and a strict **10-receiver capacity ceiling**.
- **mediasoup SFU Service (`server/sfu/sfuServer.ts` or embedded)**: Allocates one `Router` per session, one upstream `WebRtcTransport` + `Producer` per sender, and up to 10 downstream `WebRtcTransport` + `Consumer` instances per session.

---

## 1. Environment Variables

Copy `.env.example` to `.env` (never commit real secrets):

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No (default `3000`) | HTTP + WebSocket signaling port |
| `FIREBASE_PROJECT_ID` | Recommended | Firebase project ID for `verifyIdToken()` (defaults to `firebase-applet-config.json`) |
| `SESSION_TOKEN_SECRET` | **Yes in prod** | 32+ byte random HMAC secret for signing receiver session tokens |
| `SFU_SERVICE_URL` | Optional | Base HTTP URL of standalone SFU process (e.g. `http://sfu-node:3001`). Omit to run embedded SFU in the main server. |
| `SFU_PORT` | If standalone | Listening port for standalone SFU control plane (`3001`) |
| `SFU_INTERNAL_SECRET` | If standalone | Shared secret header (`x-sfu-secret`) authenticating signaling -> SFU calls |
| `MEDIASOUP_LISTEN_IP` | Yes in prod | Local bind IP (`0.0.0.0`) |
| `MEDIASOUP_ANNOUNCED_IP` | **Yes in prod** | Reachable public IPv4 (or LAN IP) advertised in SFU ICE candidates |
| `MEDIASOUP_RTC_MIN_PORT` | Yes in prod | Start of media UDP/TCP port range (e.g. `40000`) |
| `MEDIASOUP_RTC_MAX_PORT` | Yes in prod | End of media UDP/TCP port range (e.g. `40199` or `49999`) |
| `MEDIASOUP_WORKER_BIN` | Optional | Override path to `mediasoup-worker` binary |

---

## 2. Firewall, UDP Ports & NAT / TURN Notes

`mediasoup` requires direct UDP (preferred) and TCP media ports to be reachable by senders and receivers:

1. **Open Firewall Ports**:
   - Allow inbound `TCP` on `3000` (HTTP + WebSocket signaling via TLS reverse proxy).
   - Allow inbound `UDP` and `TCP` on `MEDIASOUP_RTC_MIN_PORT`–`MEDIASOUP_RTC_MAX_PORT` (e.g. `40000-40199` or `40000-49999`) directly on the SFU host.
   - Do **not** expose `SFU_PORT` (`3001`) publicly; keep it on a private VPC network protected by `SFU_INTERNAL_SECRET`.
2. **Managed Serverless / Container Notice (e.g., Cloud Run)**:
   - Managed serverless platforms that only expose a single HTTP port (`8080`/`3000`) without inbound UDP port ranges cannot route direct WebRTC SFU media over the internet without a dedicated TURN relay (`coturn`) or hosting the SFU service on a VM / Kubernetes node with host networking (`Compute Engine` / `GKE`).
3. **STUN / TURN Configuration**:
   - Configure a `coturn` server and enter its `turn:...` URL in **Settings → ICE / STUN / TURN** for receivers behind strict symmetric NATs or corporate firewalls.

---

## 3. Installing & Building

```bash
npm install
# If running in a container whose kernel tag lacks a standard prebuilt worker tarball:
node scripts/ensure-mediasoup-worker.mjs

# Type-check frontend & backend, run security rules lint, run Vitest suite, and build:
npm run lint
npm run lint:rules
npm test
npm run build
```

---

## 4. Running in Production

### Option A: Single Host (Embedded SFU)
```bash
NODE_ENV=production npm run start:prod
```

### Option B: Split Signaling + Standalone `mediasoup` SFU Microservice
Terminal 1 (Dedicated SFU Media Node with UDP `40000-49999` open):
```bash
SFU_PORT=3001 \
SFU_INTERNAL_SECRET="replace-with-strong-secret" \
MEDIASOUP_ANNOUNCED_IP="YOUR_PUBLIC_IPV4" \
MEDIASOUP_RTC_MIN_PORT=40000 \
MEDIASOUP_RTC_MAX_PORT=49999 \
npm run start:sfu
```

Terminal 2 (Signaling + SPA Server):
```bash
PORT=3000 \
SESSION_TOKEN_SECRET="replace-with-strong-secret" \
SFU_SERVICE_URL="http://127.0.0.1:3001" \
SFU_INTERNAL_SECRET="replace-with-strong-secret" \
NODE_ENV=production \
npm run start:prod
```

---

## 5. Health Checks & Firebase Console Setup

- **Signaling Health**: `GET /api/health` -> returns active sessions & connected receiver totals.
- **SFU Health**: `GET /api/health/sfu` -> returns worker PID, active routers, active producers, active consumers, and RTC port range.
- **Firebase Authorized Domains**: Add your production domain (and AI Studio preview hostnames) under **Firebase Console → Authentication → Settings → Authorized domains** so Google Sign-In popups succeed.
- **Firestore Rules**: Deploy `firestore.rules` (audited with `@firebase/eslint-plugin-security-rules`) before serving traffic.
