import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

interface ServiceAccountJson {
  project_id: string;
  client_email: string;
  private_key: string;
}

let adminAuth: Auth | null = null;

export function getFirebaseAdminAuth(): Auth {
  if (adminAuth) {
    return adminAuth;
  }
  const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encodedServiceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not configured.');
  }
  const decodedJson = Buffer.from(encodedServiceAccount, 'base64').toString(
    'utf8',
  );
  const serviceAccount = JSON.parse(decodedJson) as ServiceAccountJson;
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
  adminAuth = getAuth(app);

  return adminAuth;
}
