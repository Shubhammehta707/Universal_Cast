import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type * as mediasoupTypes from 'mediasoup/types';
import { MediasoupSfuService } from '../server/sfu/MediasoupSfuService.js';
import { SfuServiceError } from '../server/sfu/types.js';

describe('MediasoupSfuService (Real Worker, Router, Transports, Producer, 10 Consumers)', () => {
  let sfu: MediasoupSfuService;

  beforeAll(async () => {
    sfu = new MediasoupSfuService({
      rtcMinPort: 41000,
      rtcMaxPort: 41100,
      listenIp: '127.0.0.1',
      announcedIp: '127.0.0.1',
    });
    await sfu.init();
  }, 15000);

  afterAll(async () => {
    await sfu.shutdown();
  });

  it('publishes 1 upstream stream and fans out to 10 authorized consumers, rejects 11th, and isolates disconnects', async () => {
    const sessionId = 'uc_sfu_test_1';
    const senderId = 'uid_sender_1';

    const routerCaps = await sfu.getRouterRtpCapabilities(sessionId, 10);
    expect(routerCaps.codecs?.some((c) => c.mimeType.toLowerCase() === 'video/h264')).toBe(true);
    expect(routerCaps.codecs?.some((c) => c.mimeType.toLowerCase() === 'audio/opus')).toBe(true);

    // 1. Create and DTLS-connect single sender transport
    const senderTransport = await sfu.createSenderTransport(sessionId, senderId, 10);
    expect(senderTransport.id).toBeTruthy();
    expect(senderTransport.iceCandidates.length).toBeGreaterThan(0);

    await sfu.connectSenderTransport(sessionId, senderId, senderTransport.id, {
      role: 'client',
      fingerprints: [
        {
          algorithm: 'sha-256',
          value:
            'E5:5A:22:77:01:02:03:04:05:06:07:08:09:10:11:12:13:14:15:16:17:18:19:20:21:22:23:24:25:26:27:28',
        },
      ],
    });

    // 2. Produce 1 upstream H.264 video track matching Router codec payloadType
    const h264Codec = routerCaps.codecs?.find((c) => c.mimeType.toLowerCase() === 'video/h264');
    expect(h264Codec).toBeDefined();
    const sendRtpParams: mediasoupTypes.RtpParameters = {
      mid: '0',
      codecs: [
        {
          mimeType: h264Codec!.mimeType,
          payloadType: h264Codec!.preferredPayloadType!,
          clockRate: h264Codec!.clockRate,
          parameters: h264Codec!.parameters,
          rtcpFeedback: h264Codec!.rtcpFeedback,
        },
      ],
      encodings: [{ ssrc: 22222222 }],
      headerExtensions: [],
      rtcp: { cname: 'sender-stream-0', reducedSize: true },
    };
    const producer = await sfu.produce(sessionId, senderId, senderTransport.id, 'video', sendRtpParams);
    expect(producer.kind).toBe('video');

    const activeProducers = await sfu.getActiveProducers(sessionId);
    expect(activeProducers).toHaveLength(1);
    expect(activeProducers[0].producerId).toBe(producer.producerId);

    // 3. Connect 10 independent receivers and consume the single producer
    const consumerIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const receiverId = `recv_${i}`;
      const recvTransport = await sfu.createReceiverTransport(sessionId, receiverId, 10);
      await sfu.connectReceiverTransport(sessionId, receiverId, recvTransport.id, {
        role: 'client',
        fingerprints: [
          {
            algorithm: 'sha-256',
            value:
              'A1:B2:C3:D4:01:02:03:04:05:06:07:08:09:10:11:12:13:14:15:16:17:18:19:20:21:22:23:24:25:26:27:28',
          },
        ],
      });

      const consumer = await sfu.consume(
        sessionId,
        receiverId,
        producer.producerId,
        routerCaps
      );
      expect(consumer.producerId).toBe(producer.producerId);
      expect(consumer.kind).toBe('video');
      await sfu.resumeConsumer(sessionId, receiverId, consumer.id);
      consumerIds.push(consumer.id);
    }

    let metrics = await sfu.getHealthMetrics();
    expect(metrics.status).toBe('ok');
    expect(metrics.activeProducers).toBe(1);
    expect(metrics.activeReceiverTransports).toBe(10);
    expect(metrics.activeConsumers).toBe(10);

    // 4. 11th receiver MUST be rejected by SFU server-side cap
    await expect(
      sfu.createReceiverTransport(sessionId, 'recv_11', 10)
    ).rejects.toMatchObject({ statusCode: 409 });

    // 5. Disconnect receiver #3 and verify other 9 consumers + sender producer remain intact
    await sfu.disconnectReceiver(sessionId, 'recv_3');
    metrics = await sfu.getHealthMetrics();
    expect(metrics.activeProducers).toBe(1);
    expect(metrics.activeReceiverTransports).toBe(9);
    expect(metrics.activeConsumers).toBe(9);

    // Another receiver can still pause/resume unaffected
    await expect(sfu.pauseConsumer(sessionId, 'recv_4', consumerIds[3])).resolves.toBeUndefined();
    await expect(sfu.resumeConsumer(sessionId, 'recv_4', consumerIds[3])).resolves.toBeUndefined();

    // 6. Stop sender stream cleanly without dropping remaining receivers
    const closedProdIds = await sfu.closeSenderProducers(sessionId, senderId);
    expect(closedProdIds).toContain(producer.producerId);
    expect(await sfu.getActiveProducers(sessionId)).toHaveLength(0);

    // 7. Close entire session and verify zero leftover routers/transports/consumers
    await sfu.closeSession(sessionId);
    metrics = await sfu.getHealthMetrics();
    expect(metrics.activeRouters).toBe(0);
    expect(metrics.activeReceiverTransports).toBe(0);
    expect(metrics.activeConsumers).toBe(0);
  }, 20000);

  it('rejects non-host attempting to create or stop sender transport/producers', async () => {
    const sessionId = 'uc_sfu_auth_test';
    await sfu.createSenderTransport(sessionId, 'owner_uid', 5);
    await expect(sfu.createSenderTransport(sessionId, 'attacker_uid', 5)).rejects.toBeInstanceOf(
      SfuServiceError
    );
    await sfu.closeSession(sessionId);
  });
});
