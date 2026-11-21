import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { CastSession, SessionReceiver, RegisteredDevice, SessionHistoryItem } from '../types/cast';

// ---------------- SESSIONS ----------------

export async function createSessionInFirestore(session: CastSession): Promise<void> {
  const path = `sessions/${session.id}`;
  try {
    await setDoc(doc(db, 'sessions', session.id), session);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getSessionById(sessionId: string): Promise<CastSession | null> {
  const path = `sessions/${sessionId}`;
  try {
    const snap = await getDoc(doc(db, 'sessions', sessionId));
    if (!snap.exists()) return null;
    return snap.data() as CastSession;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getSessionByPin(pin: string): Promise<CastSession | null> {
  const path = 'sessions';
  try {
    const q = query(
      collection(db, 'sessions'),
      where('pin', '==', pin),
      where('status', 'in', ['active', 'paused'])
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as CastSession;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateSessionInFirestore(sessionId: string, updates: Partial<CastSession>): Promise<void> {
  const path = `sessions/${sessionId}`;
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function endSessionInFirestore(sessionId: string, senderId: string): Promise<void> {
  const path = `sessions/${sessionId}`;
  try {
    const session = await getSessionById(sessionId);
    const endedAt = new Date().toISOString();
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'ended',
      endedAt,
      updatedAt: endedAt,
    });

    if (session) {
      const started = new Date(session.createdAt).getTime();
      const ended = new Date(endedAt).getTime();
      const durationSeconds = Math.max(1, Math.round((ended - started) / 1000));
      
      const historyItem: SessionHistoryItem = {
        id: `hist_${sessionId}_${Date.now()}`,
        sessionId: session.id,
        senderId: session.senderId,
        title: session.title,
        mediaType: session.mediaType,
        receiverCount: session.receiverCount || 0,
        durationSeconds,
        startedAt: session.createdAt,
        endedAt,
      };
      await addSessionHistory(historyItem);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToSession(sessionId: string, callback: (session: CastSession | null) => void): Unsubscribe {
  const path = `sessions/${sessionId}`;
  return onSnapshot(
    doc(db, 'sessions', sessionId),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as CastSession);
      } else {
        callback(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// ---------------- RECEIVERS SUB-COLLECTION ----------------

export async function registerReceiverInFirestore(sessionId: string, receiver: SessionReceiver): Promise<void> {
  const path = `sessions/${sessionId}/receivers/${receiver.id}`;
  try {
    await setDoc(doc(db, 'sessions', sessionId, 'receivers', receiver.id), receiver);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateReceiverInFirestore(sessionId: string, receiverId: string, updates: Partial<SessionReceiver>): Promise<void> {
  const path = `sessions/${sessionId}/receivers/${receiverId}`;
  try {
    await updateDoc(doc(db, 'sessions', sessionId, 'receivers', receiverId), {
      ...updates,
      lastPing: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeReceiverFromFirestore(sessionId: string, receiverId: string): Promise<void> {
  const path = `sessions/${sessionId}/receivers/${receiverId}`;
  try {
    await deleteDoc(doc(db, 'sessions', sessionId, 'receivers', receiverId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToSessionReceivers(sessionId: string, callback: (receivers: SessionReceiver[]) => void): Unsubscribe {
  const path = `sessions/${sessionId}/receivers`;
  return onSnapshot(
    collection(db, 'sessions', sessionId, 'receivers'),
    (snap) => {
      const list: SessionReceiver[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as SessionReceiver);
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// ---------------- REGISTERED HARDWARE DEVICES ----------------

export async function getRegisteredDevices(userId: string): Promise<RegisteredDevice[]> {
  if (!userId || userId.startsWith('guest_')) return [];
  const path = 'devices';
  try {
    const q = query(collection(db, 'devices'), where('ownerId', '==', userId));
    const snap = await getDocs(q);
    const devices: RegisteredDevice[] = [];
    snap.forEach((d) => devices.push(d.data() as RegisteredDevice));
    return devices;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addRegisteredDevice(device: RegisteredDevice): Promise<void> {
  const path = `devices/${device.id}`;
  try {
    await setDoc(doc(db, 'devices', device.id), device);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteRegisteredDevice(deviceId: string): Promise<void> {
  const path = `devices/${deviceId}`;
  try {
    await deleteDoc(doc(db, 'devices', deviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------- SESSION HISTORY ----------------

export async function addSessionHistory(item: SessionHistoryItem): Promise<void> {
  const path = `sessionHistory/${item.id}`;
  try {
    await setDoc(doc(db, 'sessionHistory', item.id), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getUserSessionHistory(userId: string): Promise<SessionHistoryItem[]> {
  if (!userId || userId.startsWith('guest_')) return [];
  const path = 'sessionHistory';
  try {
    const q = query(
      collection(db, 'sessionHistory'),
      where('senderId', '==', userId)
    );
    const snap = await getDocs(q);
    const history: SessionHistoryItem[] = [];
    snap.forEach((d) => history.push(d.data() as SessionHistoryItem));
    // Sort descending by startedAt
    return history.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
