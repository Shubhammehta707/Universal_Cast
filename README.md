# UniversalCast — Universal Multi-Screen Casting Platform

UniversalCast is a full-stack web application for multi-screen screen mirroring and media casting to up to 10 receiver devices simultaneously.

## System Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons.
- **Backend / Real-Time**: Node.js, Express, WebSocket server (`ws`) handling WebRTC signaling (SDP offer/answer, ICE exchange) with server-authoritative 10-receiver limit enforcement.
- **Media Engine**: Native WebRTC browser APIs (`navigator.mediaDevices.getDisplayMedia`), hardware-accelerated H.264 video, Opus stereo audio, Google interactive STUN servers (`stun:stun.l.google.com:19302`).
- **Database & Identity**: Firebase Authentication (Google Sign-In), Cloud Firestore for user profiles, registered hardware displays, active session telemetry, and historical archives. Protected by zero-trust Firestore Security Rules (ABAC).

---

## The 12 Application Views

1. **Landing Page**: Platform showcase, 1-to-10 multi-receiver architectural diagram, and Quick PIN Join Box.
2. **Sign-In Page**: Google Sign-In via Firebase Auth and Guest Broadcaster quick access.
3. **Sender Dashboard**: Broadcaster command center, active cast resuming, registered screen presets, and real-time metrics.
4. **Create Session Page**: Media selector (Screen Mirroring, Video, Photo Slides, Audio), temporary 6-digit PIN generator, and receiver limit slider (1–10).
5. **Device Discovery Page**: Local Wi-Fi / LAN subnet simulated discovery probe and pairing with saved displays.
6. **QR / PIN Pairing Page**: High-contrast 6-digit PIN display, live SVG/Canvas QR code, direct receiver invite URL, and live connection counter.
7. **Active Casting Studio**: Live stream preview monitor, play/pause and audio mute controls, live telemetry (bitrate, fps, duration), and a 10-slot receiver fleet matrix.
8. **Receiver Management Page**: Telemetry inspector and force-disconnect controls for individual screens.
9. **Browser Receiver Page** (`/receiver`): TV-friendly full-screen player with large fonts, TV remote-friendly on-screen numeric keypad, autoplay audio unlock modal, and shortcut controls (`F` for fullscreen, `H` for HUD).
10. **Device Registration Page**: Form to register permanent hardware displays (e.g., Living Room TV, Conference Projector) with resolution and device type into Firestore.
11. **Session History Page**: Persistent history log loaded from Cloud Firestore with exportable JSON analytics.
12. **Settings Page**: WebRTC ICE candidates, STUN/TURN configurations, video codec selection (H.264 / VP8 / VP9), and Dark/Light theme toggles.

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
# Port for Express dev and production server
PORT=3000

# Base URL of hosted applet
APP_URL="http://localhost:3000"
```

Firebase credentials are automatically read from `firebase-applet-config.json` generated during provisioning.

---

## Installation & Run Commands

```bash
# Install dependencies
npm install

# Run full-stack dev server (Express + WebSockets + Vite)
npm run dev

# Build production bundle
npm run build

# Start production server
npm start
```

---

## Multi-Screen Testing Instructions

1. Start the application by running `npm run dev`.
2. Open the app in your primary browser window at `http://localhost:3000`.
3. Click **"New Broadcast"** or select **"Screen Mirroring"** on the Dashboard.
4. Set title, PIN, and click **"Launch Session & Pair"**.
5. In another browser tab, private window, or on a secondary device on the same network:
   - Go to `http://localhost:3000` and enter the 6-digit PIN in the Quick Join box, or
   - Scan the QR code / open the direct receiver link.
6. Return to the host window: observe the receiver appear in the 10-slot fleet matrix with live latency and FPS.
7. Click **"Start Screen Capture"** on the host: choose any window or desktop screen.
8. The receiver will immediately display the live screen mirror with sub-second latency!
9. Test independent disconnection: click the trash icon next to a receiver in the host console to verify it disconnects only that receiver without interrupting others.
