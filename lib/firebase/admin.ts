import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  // settings() must be called immediately after app init, before any Firestore usage
  admin.firestore(app).settings({ ignoreUndefinedProperties: true });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();
const adminStorage = admin.storage();

export { admin, adminAuth, adminDb, adminStorage };