import { describe, expect, it } from 'vitest';
import {
  getScreenCaptureErrorMessage,
  getScreenCaptureUnavailableMessage,
  ScreenCaptureDiagnostics,
} from '../src/utils/screenCapture';

const secureStandalone: ScreenCaptureDiagnostics = {
  secureContext: true,
  hasMediaDevices: true,
  hasGetDisplayMedia: true,
  origin: 'http://localhost:3000',
  isIframe: false,
  displayCaptureAllowed: null,
};

describe('screen capture error messages', () => {
  it('explains secure-context requirements', () => {
    expect(getScreenCaptureUnavailableMessage({ ...secureStandalone, secureContext: false }))
      .toMatch(/secure browser context/i);
  });

  it('distinguishes unsupported API from embedded-preview restrictions', () => {
    expect(getScreenCaptureUnavailableMessage({
      ...secureStandalone,
      hasGetDisplayMedia: false,
    })).toMatch(/does not provide the screen-capture API/i);
    expect(getScreenCaptureUnavailableMessage({
      ...secureStandalone,
      isIframe: true,
      displayCaptureAllowed: false,
    })).toMatch(/embedded preview blocks screen sharing/i);
  });

  it('distinguishes denial, cancellation, and unavailable sources', () => {
    expect(getScreenCaptureErrorMessage(new DOMException('', 'NotAllowedError'), secureStandalone))
      .toMatch(/denied or cancelled/i);
    expect(getScreenCaptureErrorMessage(new DOMException('', 'AbortError'), secureStandalone))
      .toMatch(/cancelled/i);
    expect(getScreenCaptureErrorMessage(new DOMException('', 'NotFoundError'), secureStandalone))
      .toMatch(/No screen/i);
  });

  it('does not expose raw browser error text', () => {
    const message = getScreenCaptureErrorMessage(new Error('sensitive browser detail'), secureStandalone);
    expect(message).toMatch(/Screen capture failed/i);
    expect(message).not.toContain('sensitive browser detail');
  });
});
