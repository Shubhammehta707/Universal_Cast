import { SfuServiceError, } from './types.js';
export class RemoteSfuClient {
    baseUrl;
    secret;
    constructor(baseUrl, secret) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.secret = secret;
    }
    async request(method, path, body) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(this.secret ? { 'x-sfu-secret': this.secret } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = (await res.json().catch(() => ({})));
        if (!res.ok) {
            throw new SfuServiceError(res.status, data.error || `Remote SFU HTTP ${res.status}`);
        }
        return data;
    }
    async init() {
        await this.request('GET', '/health');
    }
    async getRouterRtpCapabilities(sessionId, maxReceivers) {
        const res = await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/router`, { maxReceivers });
        return res.rtpCapabilities;
    }
    async createSenderTransport(sessionId, senderId, maxReceivers) {
        return this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/sender-transport`, { senderId, maxReceivers });
    }
    async connectSenderTransport(sessionId, senderId, transportId, dtlsParameters) {
        await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/sender-transport/connect`, {
            senderId,
            transportId,
            dtlsParameters,
        });
    }
    async produce(sessionId, senderId, transportId, kind, rtpParameters, appData) {
        return this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/produce`, { senderId, transportId, kind, rtpParameters, appData });
    }
    async closeSenderProducers(sessionId, senderId) {
        const res = await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/producers/close`, { senderId });
        return res.closedIds;
    }
    async getActiveProducers(sessionId) {
        const res = await this.request('GET', `/sfu/sessions/${encodeURIComponent(sessionId)}/producers`);
        return res.producers;
    }
    async createReceiverTransport(sessionId, receiverId, maxReceivers) {
        return this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/receiver-transport`, { receiverId, maxReceivers });
    }
    async connectReceiverTransport(sessionId, receiverId, transportId, dtlsParameters) {
        await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/receiver-transport/connect`, {
            receiverId,
            transportId,
            dtlsParameters,
        });
    }
    async consume(sessionId, receiverId, producerId, rtpCapabilities) {
        return this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/consume`, { receiverId, producerId, rtpCapabilities });
    }
    async resumeConsumer(sessionId, receiverId, consumerId) {
        await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/consumers/${encodeURIComponent(consumerId)}/resume`, {
            receiverId,
        });
    }
    async pauseConsumer(sessionId, receiverId, consumerId) {
        await this.request('POST', `/sfu/sessions/${encodeURIComponent(sessionId)}/consumers/${encodeURIComponent(consumerId)}/pause`, {
            receiverId,
        });
    }
    async disconnectReceiver(sessionId, receiverId) {
        await this.request('DELETE', `/sfu/sessions/${encodeURIComponent(sessionId)}/receivers/${encodeURIComponent(receiverId)}`);
    }
    async closeSession(sessionId) {
        await this.request('DELETE', `/sfu/sessions/${encodeURIComponent(sessionId)}`);
    }
    async getHealthMetrics() {
        const metrics = await this.request('GET', '/health');
        return { ...metrics, mode: 'remote' };
    }
    async shutdown() {
        // Remote SFU manages its own process lifecycle
    }
}
//# sourceMappingURL=RemoteSfuClient.js.map