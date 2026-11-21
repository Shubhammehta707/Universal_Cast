import crypto from 'crypto';
import { clampMaxReceivers, HARD_MAX_RECEIVERS, isValidId, isValidPin, normalizeDeviceType, normalizeMediaType, sanitizeString, } from '../utils/validation.js';
import { issueReceiverToken, verifyReceiverToken } from './tokenService.js';
import { verifyFirebaseIdToken } from './firebaseAuth.js';
import { logger } from '../utils/logger.js';
export class SessionAuthError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
export class SessionManager {
    sessions = new Map();
    async createOrVerifyHostSession(params) {
        const identity = await this.authenticateSender(params.idToken);
        if (!isValidId(params.sessionId)) {
            throw new SessionAuthError(400, 'Invalid sessionId');
        }
        if (!isValidPin(params.pin)) {
            throw new SessionAuthError(400, 'PIN must be 6 digits');
        }
        const existing = this.sessions.get(params.sessionId);
        if (existing) {
            if (existing.senderId !== identity.uid) {
                throw new SessionAuthError(403, 'Forbidden: session belongs to another host');
            }
            if (existing.pin !== params.pin) {
                throw new SessionAuthError(409, 'PIN cannot be changed after a live session is registered');
            }
            existing.mediaType = normalizeMediaType(params.mediaType);
            existing.title = sanitizeString(params.title, 100, existing.title);
            existing.maxReceivers = clampMaxReceivers(params.maxReceivers);
            return existing;
        }
        // Ensure PIN uniqueness across currently active sessions
        for (const room of this.sessions.values()) {
            if (room.pin === params.pin) {
                throw new SessionAuthError(409, 'PIN collision with another active session; please re-roll PIN');
            }
        }
        const session = {
            sessionId: params.sessionId,
            pin: params.pin,
            title: sanitizeString(params.title, 100, 'Live Cast Session'),
            senderId: identity.uid,
            senderName: sanitizeString(identity.name || identity.email?.split('@')[0], 60, 'UniversalCast Host'),
            mediaType: normalizeMediaType(params.mediaType),
            maxReceivers: clampMaxReceivers(params.maxReceivers),
            senderWs: null,
            receivers: new Map(),
            kickedReceiverIds: new Set(),
            createdAt: Date.now(),
        };
        this.sessions.set(params.sessionId, session);
        logger.info('Session registered in SessionManager', {
            sessionId: session.sessionId,
            senderId: session.senderId,
            maxReceivers: session.maxReceivers,
        });
        return session;
    }
    async attachSenderSocket(params) {
        const identity = await this.authenticateSender(params.idToken);
        if (!isValidId(params.sessionId)) {
            throw new SessionAuthError(400, 'Invalid sessionId');
        }
        let room = this.sessions.get(params.sessionId);
        if (!room) {
            if (!isValidPin(params.pin)) {
                throw new SessionAuthError(404, 'Session not initialized and missing valid 6-digit PIN');
            }
            room = await this.createOrVerifyHostSession({
                idToken: params.idToken,
                sessionId: params.sessionId,
                pin: params.pin,
                title: 'Live Cast Session',
                mediaType: params.mediaType,
                maxReceivers: params.maxReceivers,
            });
        }
        else if (room.senderId !== identity.uid) {
            throw new SessionAuthError(403, 'Forbidden: not the session host');
        }
        room.senderWs = params.ws;
        if (params.senderName) {
            room.senderName = sanitizeString(params.senderName, 60, room.senderName);
        }
        if (params.mediaType) {
            room.mediaType = normalizeMediaType(params.mediaType);
        }
        return room;
    }
    validatePinAndIssueReceiverToken(params) {
        if (!isValidPin(params.pin)) {
            throw new SessionAuthError(400, 'PIN must be a 6-digit numeric code');
        }
        const room = this.findSession(params.sessionId, params.pin);
        if (!room) {
            throw new SessionAuthError(404, 'No active live session found for this PIN');
        }
        if (room.pin !== params.pin) {
            throw new SessionAuthError(403, 'Incorrect 6-digit PIN');
        }
        if (room.receivers.size >= Math.min(room.maxReceivers, HARD_MAX_RECEIVERS)) {
            throw new SessionAuthError(409, `Session capacity reached (Max ${room.maxReceivers} receivers)`);
        }
        const receiverId = `recv_${crypto.randomBytes(6).toString('hex')}`;
        const receiverToken = issueReceiverToken(room.sessionId, receiverId);
        return { session: room, receiverId, receiverToken };
    }
    joinReceiver(params) {
        let targetSessionId = params.sessionId && params.sessionId !== 'lookup' ? params.sessionId : undefined;
        let resolvedReceiverId = isValidId(params.receiverId) ? params.receiverId : undefined;
        let issuedToken = params.receiverToken || '';
        // Verify receiver token if provided
        if (params.receiverToken) {
            const tokenPayload = verifyReceiverToken(params.receiverToken);
            if (!tokenPayload) {
                throw new SessionAuthError(401, 'Invalid or expired receiver authorization token');
            }
            if (targetSessionId && tokenPayload.sessionId !== targetSessionId) {
                throw new SessionAuthError(403, 'Receiver token does not match requested session');
            }
            targetSessionId = tokenPayload.sessionId;
            resolvedReceiverId = tokenPayload.receiverId;
        }
        const room = this.findSession(targetSessionId, params.pin);
        if (!room) {
            throw new SessionAuthError(404, 'Session is not active or host is offline');
        }
        // Either valid token OR matching PIN is required (and if PIN supplied, it MUST match)
        if (!params.receiverToken) {
            if (!isValidPin(params.pin) || room.pin !== params.pin) {
                throw new SessionAuthError(403, 'Invalid 6-digit session PIN');
            }
            if (!resolvedReceiverId) {
                resolvedReceiverId = `recv_${crypto.randomBytes(6).toString('hex')}`;
            }
            issuedToken = issueReceiverToken(room.sessionId, resolvedReceiverId);
        }
        else if (params.pin && room.pin !== params.pin) {
            throw new SessionAuthError(403, 'PIN does not match authorized session');
        }
        if (!resolvedReceiverId) {
            throw new SessionAuthError(400, 'Invalid receiverId');
        }
        if (room.kickedReceiverIds.has(resolvedReceiverId)) {
            throw new SessionAuthError(403, 'This receiver was disconnected by the host');
        }
        const isExistingSlot = room.receivers.has(resolvedReceiverId);
        const hardLimit = Math.min(room.maxReceivers, HARD_MAX_RECEIVERS);
        if (!isExistingSlot && room.receivers.size >= hardLimit) {
            throw new SessionAuthError(409, `Session has reached the limit of ${hardLimit} receivers.`);
        }
        const receiver = {
            receiverId: resolvedReceiverId,
            ws: params.ws,
            deviceName: sanitizeString(params.deviceName, 60, 'Browser Receiver'),
            deviceType: normalizeDeviceType(params.deviceType),
            joinedAt: new Date().toISOString(),
        };
        room.receivers.set(resolvedReceiverId, receiver);
        return { session: room, receiver, issuedToken };
    }
    assertSenderAuthorizedForRoom(sessionId, ws) {
        const room = this.sessions.get(sessionId);
        if (!room) {
            throw new SessionAuthError(404, 'Session not found');
        }
        if (room.senderWs !== ws) {
            throw new SessionAuthError(403, 'Unauthorized: only the authenticated session host can perform this action');
        }
        return room;
    }
    async assertSenderTokenForSession(sessionId, idToken) {
        const identity = await this.authenticateSender(idToken);
        const room = this.sessions.get(sessionId);
        if (!room) {
            throw new SessionAuthError(404, 'Session not found');
        }
        if (room.senderId !== identity.uid) {
            throw new SessionAuthError(403, 'Forbidden: session belongs to a different user');
        }
        return room;
    }
    assertReceiverInRoom(sessionId, receiverId, ws) {
        const room = this.sessions.get(sessionId);
        if (!room) {
            throw new SessionAuthError(404, 'Session not found');
        }
        const receiver = room.receivers.get(receiverId);
        if (!receiver) {
            throw new SessionAuthError(403, 'Receiver is not joined to this session');
        }
        if (ws && receiver.ws && receiver.ws !== ws) {
            throw new SessionAuthError(403, 'WebSocket connection mismatch for receiver');
        }
        return { session: room, receiver };
    }
    removeReceiver(sessionId, receiverId, markKicked = false) {
        const room = this.sessions.get(sessionId);
        if (!room)
            return null;
        const receiver = room.receivers.get(receiverId);
        room.receivers.delete(receiverId);
        if (markKicked) {
            room.kickedReceiverIds.add(receiverId);
        }
        return { session: room, receiver };
    }
    endSession(sessionId) {
        const room = this.sessions.get(sessionId);
        if (room) {
            this.sessions.delete(sessionId);
        }
        return room;
    }
    pruneStaleUnattachedSessions(maxAgeMs = 15 * 60 * 1000, nowMs = Date.now()) {
        let pruned = 0;
        for (const [sid, room] of this.sessions.entries()) {
            if (!room.senderWs && room.receivers.size === 0 && nowMs - room.createdAt > maxAgeMs) {
                this.sessions.delete(sid);
                pruned += 1;
            }
        }
        return pruned;
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    listSessionIds() {
        return Array.from(this.sessions.keys());
    }
    getActiveSessionCount() {
        return this.sessions.size;
    }
    getTotalReceiverCount() {
        let total = 0;
        for (const s of this.sessions.values()) {
            total += s.receivers.size;
        }
        return total;
    }
    findSession(sessionId, pin) {
        if (sessionId && sessionId !== 'lookup') {
            return this.sessions.get(sessionId);
        }
        if (pin) {
            for (const room of this.sessions.values()) {
                if (room.pin === pin)
                    return room;
            }
        }
        return undefined;
    }
    async authenticateSender(idToken) {
        try {
            const identity = await verifyFirebaseIdToken(idToken);
            if (!identity.emailVerified) {
                throw new SessionAuthError(403, 'Verified Google account email is required to host a session');
            }
            return identity;
        }
        catch (err) {
            if (err instanceof SessionAuthError)
                throw err;
            throw new SessionAuthError(401, err instanceof Error ? err.message : 'Invalid Firebase ID token');
        }
    }
}
//# sourceMappingURL=SessionManager.js.map