const admin = require('firebase-admin');

// IMPORTANT: The user must provide their own firebase-adminsdk.json
// or set up environment variables for Firebase Admin SDK.
// For now, this is a placeholder stub that prevents crashes.

let isFirebaseInitialized = false;

try {
  // If FIREBASE_SERVICE_ACCOUNT is provided in .env as a JSON string:
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log('✅  Firebase Admin SDK initialized successfully.');
  } else {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not found in .env. Push notifications will be disabled.');
  }
} catch (error) {
  console.error('❌  Firebase initialization failed:', error.message);
}

const sendPushNotification = async (tokens, title, body, data = {}) => {
  if (!isFirebaseInitialized || !tokens || tokens.length === 0) return;

  const message = {
    notification: { title, body },
    data,
    tokens // Send to multiple devices
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Sent ${response.successCount} successful messages.`);
  } catch (error) {
    console.error('[FCM] Error sending push notification:', error.message);
  }
};

module.exports = {
  admin,
  sendPushNotification,
  isFirebaseInitialized
};
