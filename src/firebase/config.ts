import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure singleton initialization of Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: The app will break without this line
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Single Auth instance throughout the entire application
export const auth: Auth = getAuth(app);

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
    }
  }
}

// Initial boot test
testConnection();
