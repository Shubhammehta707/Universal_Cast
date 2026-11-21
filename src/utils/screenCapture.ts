export interface ScreenCaptureDiagnostics {
  secureContext: boolean;
  hasMediaDevices: boolean;
  hasGetDisplayMedia: boolean;
  origin: string;
  isIframe: boolean;
  displayCaptureAllowed: boolean | null;
}

type CapturePolicy = {
  allowsFeature?: (feature: string) => boolean;
};

export function getScreenCaptureDiagnostics(): ScreenCaptureDiagnostics {
  const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  const policyDocument = typeof document === 'undefined'
    ? undefined
    : document as Document & { permissionsPolicy?: CapturePolicy; featurePolicy?: CapturePolicy };
  const policy = policyDocument?.permissionsPolicy ?? policyDocument?.featurePolicy;

  return {
    secureContext: typeof window !== 'undefined' && window.isSecureContext,
    hasMediaDevices: Boolean(mediaDevices),
    hasGetDisplayMedia: typeof mediaDevices?.getDisplayMedia === 'function',
    origin: typeof window !== 'undefined' ? window.location.origin : 'unavailable',
    isIframe: typeof window !== 'undefined' && window.self !== window.top,
    displayCaptureAllowed: policy?.allowsFeature
      ? policy.allowsFeature('display-capture')
      : null,
  };
}

export function getScreenCaptureUnavailableMessage(diagnostics: ScreenCaptureDiagnostics): string {
  if (!diagnostics.secureContext) {
    return 'Screen sharing requires a secure browser context. Open UniversalCast using http://localhost or HTTPS.';
  }
  if (diagnostics.isIframe && diagnostics.displayCaptureAllowed === false) {
    return 'This embedded preview blocks screen sharing. Open UniversalCast in a standalone browser tab or allow the display-capture permission.';
  }
  if (!diagnostics.hasMediaDevices || !diagnostics.hasGetDisplayMedia) {
    if (diagnostics.isIframe) {
      return 'Screen sharing is unavailable in this embedded preview. Open UniversalCast in a standalone browser tab; the preview may restrict display capture.';
    }
    return 'This browser does not provide the screen-capture API. Use a supported desktop browser in a secure context.';
  }
  return 'Screen capture is unavailable in this browser context.';
}

export function getScreenCaptureErrorMessage(
  error: unknown,
  diagnostics: ScreenCaptureDiagnostics
): string {
  const name = error instanceof DOMException ? error.name : '';
  if (!diagnostics.secureContext || name === 'SecurityError') {
    return getScreenCaptureUnavailableMessage({ ...diagnostics, secureContext: false });
  }
  if (diagnostics.isIframe && diagnostics.displayCaptureAllowed === false) {
    return getScreenCaptureUnavailableMessage(diagnostics);
  }
  if (name === 'NotAllowedError') {
    if (diagnostics.isIframe) {
      return 'Screen capture was denied or cancelled, or blocked by the embedded preview. Open UniversalCast in a standalone tab and check browser permissions.';
    }
    return 'Screen capture was denied or cancelled. Allow screen sharing in your browser; on macOS, check System Settings > Privacy & Security > Screen Recording.';
  }
  if (name === 'AbortError') {
    return 'Screen capture was cancelled before it started.';
  }
  if (name === 'NotFoundError') {
    return 'No screen, window, or tab is available to share.';
  }
  if (name === 'NotReadableError') {
    return 'The selected screen could not be captured. Close other capture apps and try again.';
  }
  return 'Screen capture failed. Check browser permissions and try again.';
}
