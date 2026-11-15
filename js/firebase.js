// Firebase setup. The web config is public by design (it ships in the page);
// access to data is guarded by firestore.rules, and AI calls by App Check.
const V = "13.2.0";
const base = `https://www.gstatic.com/firebasejs/${V}`;

const { initializeApp } = await import(`${base}/firebase-app.js`);
const authMod = await import(`${base}/firebase-auth.js`);
const fs = await import(`${base}/firebase-firestore.js`);

export const firebaseConfig = {
  apiKey: "AIzaSyAaipJKy91HgxTMoLRufuKtT4Y-GBaTxeM",
  authDomain: "budzet-d6445.firebaseapp.com",
  projectId: "budzet-d6445",
  storageBucket: "budzet-d6445.firebasestorage.app",
  messagingSenderId: "603250109805",
  appId: "1:603250109805:web:91f8dbc3f061e6e2ac3e64",
};

// reCAPTCHA Enterprise site key used by App Check (required by Firebase AI Logic).
export const RECAPTCHA_KEY = "6Le3IiIuAAAAAFZUwJ_5QX_yjU0K8yj4mgMIm1QP";

export const app = initializeApp(firebaseConfig);

let appCheckReady = Promise.resolve(null);
if (RECAPTCHA_KEY && !RECAPTCHA_KEY.startsWith("__")) {
  appCheckReady = import(`${base}/firebase-app-check.js`)
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) =>
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_KEY),
        isTokenAutoRefreshEnabled: true,
      }),
    )
    .catch((e) => {
      console.error("App Check", e);
      return null;
    });
}
export { appCheckReady };

export const auth = authMod.getAuth(app);
export const googleProvider = new authMod.GoogleAuthProvider();
export const { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } = authMod;

export const db = fs.initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
});
export { fs };

let aiModPromise = null;
/** Lazily loads the Firebase AI Logic module (Gemini). */
export async function getAiModule() {
  await appCheckReady;
  aiModPromise ??= import(`${base}/firebase-ai.js`);
  return aiModPromise;
}
