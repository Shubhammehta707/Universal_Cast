import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface VerifiedSenderIdentity {
  uid: string;
  email?: string;
  name?: string;
  emailVerified: boolean;
}

type TokenVerifierFn = (idToken: string) => Promise<VerifiedSenderIdentity>;

let customVerifier: TokenVerifierFn | null = null;
let cachedProjectId: string | null = null;

function resolveProjectId(): string {
  if (cachedProjectId) return cachedProjectId;
  if (process.env.FIREBASE_PROJECT_ID) {
    cachedProjectId = process.env.FIREBASE_PROJECT_ID;
    return cachedProjectId;
  }
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId) {
      cachedProjectId = parsed.projectId;
      return cachedProjectId;
    }
  } catch (err) {
    logger.warn('Could not read firebase-applet-config.json for projectId', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
  throw new Error('FIREBASE_PROJECT_ID is not configured');
}

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  const projectId = resolveProjectId();
  return initializeApp({ projectId });
}

export function setCustomTokenVerifier(fn: TokenVerifierFn | null): void {
  customVerifier = fn;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedSenderIdentity> {
  if (!idToken || typeof idToken !== 'string' || idToken.length > 8192) {
    throw new Error('Invalid or missing Firebase ID token');
  }

  if (customVerifier) {
    return customVerifier(idToken);
  }

  const app = getAdminApp();
  const decoded: DecodedIdToken = await getAuth(app).verifyIdToken(idToken, false);

  if (!decoded.uid) {
    throw new Error('Firebase ID token missing uid');
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
    name: typeof decoded.name === 'string' ? decoded.name : undefined,
    emailVerified: decoded.email_verified === true,
  };
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  const token = parts[1].trim();
  return token.length > 0 ? token : null;
}
