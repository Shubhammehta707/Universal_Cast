# UniversalCast Firestore Security Specification (Hardened Zero-Trust ABAC)

## 1. Data Invariants

1. **Zero Unauthenticated Access**: No unauthenticated client (`request.auth == null`) may read, list, create, update, or delete any Firestore document. Receiver PIN lookups and stream authorization are handled by the backend Session Manager (`POST /api/sessions/validate-pin`) with HMAC-signed receiver tokens and rate limiting, eliminating public PIN scraping in Firestore.
2. **Email Verification Gate**: All writes require `request.auth.token.email_verified == true`.
3. **User Isolation (PII Protection)**: `/users/{userId}` can only be read (`get`), created, or updated by `request.auth.uid == userId`. Collection `list` on `/users` is strictly denied (`allow list: if false`).
4. **Device Ownership**: `/devices/{deviceId}` requires `ownerId == request.auth.uid` on reads, lists, creates, updates, and deletes, with immutable `id`, `ownerId`, and `createdAt`.
5. **Session Ownership & Hard Limit (Max 10 Receivers)**:
   - Only the authenticated owner (`senderId == request.auth.uid`) can create, read, list, update, or delete their `/sessions/{sessionId}` documents.
   - `maxReceivers` is strictly clamped to integer/number `1 <= maxReceivers <= 10`.
   - `receiverCount` must be `>= 0` and `<= existing().maxReceivers` (and `<= 10`).
   - `activeReceiverIds` list length must be `<= existing().maxReceivers` (and `<= 10`).
   - `pin` must match `^[0-9]{6}$`.
   - `id`, `pin`, `senderId`, `maxReceivers`, and `createdAt` are strictly immutable after creation.
   - Terminal state locking: once `status == 'ended'`, no further updates are permitted.
6. **Receiver Subcollection Master Gate**:
   - `/sessions/{sessionId}/receivers/{receiverId}` requires `senderId == request.auth.uid` AND relational `get()` verification on `/sessions/{sessionId}` for mutations, while `allow list` validates `resource.data.senderId == request.auth.uid` without O(n) `get()` calls.
7. **Immutable Session History**:
   - `/sessionHistory/{historyId}` can only be read, listed, created, or deleted by `senderId == request.auth.uid`, and `allow update: if false` makes records immutable.

## 2. The Dirty Dozen Payloads (Adversarial Audit)

1. **Unauthenticated Session Scraping (`list` on `/sessions`)**:
   - Actor: Unauthenticated client (`request.auth == null`).
   - Expected: `PERMISSION_DENIED`.
2. **Unauthenticated PIN Spoof / Session Creation (`create` on `/sessions/{id}`)**:
   - Actor: Unauthenticated client (`!isSignedIn()`).
   - Expected: `PERMISSION_DENIED`.
3. **Ghost Field Poisoning (`isAdmin: true`)**:
   - Payload: `{ id: "sess_1", senderId: "uid1", pin: "123456", title: "Test", status: "active", mediaType: "screen", maxReceivers: 10, isAdmin: true }`.
   - Expected: `PERMISSION_DENIED` (blocked by `keys().hasOnly(...)`).
4. **Sender Spoofing (`senderId != request.auth.uid`)**:
   - Payload: `{ id: "sess_2", senderId: "victim_uid", ... }` sent by `attacker_uid`.
   - Expected: `PERMISSION_DENIED`.
5. **Receiver Limit Bypass (`maxReceivers: 50` or `receiverCount: 15`)**:
   - Payload: `maxReceivers: 50` on create, or `receiverCount: 11` on update.
   - Expected: `PERMISSION_DENIED`.
6. **PIN Format Poisoning (`pin: "abcdef"`)**:
   - Payload: `pin` not matching `^[0-9]{6}$`.
   - Expected: `PERMISSION_DENIED`.
7. **Immutable Field Mutation (`senderId` or `pin` or `maxReceivers` change on update)**:
   - Update Payload: `{ senderId: "new_owner" }` or `{ maxReceivers: 100 }`.
   - Expected: `PERMISSION_DENIED`.
8. **Terminal State Resurrection (`ended` -> `active`)**:
   - Update on session where `existing().status == 'ended'`.
   - Expected: `PERMISSION_DENIED`.
9. **Cross-User Device Hijack & History Read**:
   - Attacker reading/updating `/devices/victim_dev` or `/sessionHistory/victim_hist`.
   - Expected: `PERMISSION_DENIED`.
10. **Cross-User Profile PII Leak (`get`/`list` on `/users`)**:
    - Attacker reading `/users/victim_uid` or listing `/users`.
    - Expected: `PERMISSION_DENIED`.
11. **Path Variable ID Poisoning (500-char or invalid characters in doc ID)**:
    - Target: `/sessions/bad$id!...` or 500-char ID.
    - Expected: `PERMISSION_DENIED` (`isValidId` guard).
12. **Unverified Email Token Spoof (`email_verified: false`)**:
    - Write attempt with `request.auth.token.email_verified == false`.
    - Expected: `PERMISSION_DENIED`.
