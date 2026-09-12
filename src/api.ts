import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  connectStorageEmulator,
} from "firebase/storage";
import { connectAuthEmulator } from "firebase/auth";
import { execute, viewStore, emptyStore } from "../functions/src/engine.mjs";
import { seed } from "./demo";
export const demo = !import.meta.env.VITE_FIREBASE_PROJECT_ID;
const app = demo
  ? null
  : initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    });
const auth = app ? getAuth(app) : null,
  functions = app
    ? getFunctions(app, import.meta.env.VITE_FUNCTIONS_REGION || "us-central1")
    : null,
  storage = app ? getStorage(app) : null;
if (
  auth &&
  functions &&
  storage &&
  import.meta.env.VITE_USE_EMULATORS === "true"
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
export type Actor = {
  uid: string;
  email?: string;
  anonymous: boolean;
  admin?: boolean;
  emailVerified?: boolean;
};
let actor: Actor = {
  uid: "demo-customer",
  anonymous: false,
  email: "aditi@example.test",
  emailVerified: true,
};
const KEY = "grove-demo-v1";
function read() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : { "green-basket": seed() };
}
export async function start(cb: (a: Actor) => void) {
  if (demo) {
    cb(actor);
    return () => {};
  }
  return onAuthStateChanged(auth!, async (u) => {
    if (!u) {
      try {
        await signInAnonymously(auth!);
      } catch (e) {
        window.dispatchEvent(
          new CustomEvent("app-error", {
            detail:
              "Enable Firebase Anonymous Authentication to browse and shop.",
          }),
        );
      }
      return;
    }
    const token = await u.getIdTokenResult();
    actor = {
      uid: u.uid,
      anonymous: u.isAnonymous,
      email: u.email || "",
      emailVerified: u.emailVerified,
      admin: token.claims.platformAdmin === true,
    };
    cb(actor);
  });
}
export function demoRole(role: string) {
  actor = {
    uid: role === "owner" ? "demo-owner" : "demo-customer",
    anonymous: false,
    email: role === "owner" ? "owner@example.test" : "aditi@example.test",
    emailVerified: true,
  };
  return actor;
}
export async function login(
  email: string,
  password: string,
  register: boolean,
) {
  if (demo)
    throw Error(
      "Account sign-in is available after Firebase setup. Use the demo role switch to explore.",
    );
  if (register) {
    const cred = EmailAuthProvider.credential(email, password);
    const result = auth!.currentUser?.isAnonymous
      ? await linkWithCredential(auth!.currentUser, cred)
      : await createUserWithEmailAndPassword(auth!, email, password);
    await sendEmailVerification(result.user);
  } else await signInWithEmailAndPassword(auth!, email, password);
}
export async function logout() {
  if (auth) await signOut(auth);
}
export async function resetPassword(email: string) {
  if (!auth) throw Error("Firebase setup required");
  await sendPasswordResetEmail(auth, email);
}
export async function verifyEmail() {
  if (!auth?.currentUser) throw Error("Sign in first");
  await sendEmailVerification(auth.currentUser);
}
export async function api(
  storeId: string,
  command: string,
  data: any = {},
  requestId: string = crypto.randomUUID(),
): Promise<any> {
  if (!demo) {
    const result = await httpsCallable(
      functions!,
      "storeApi",
    )({ storeId, command, data, requestId });
    return result.data;
  }
  return navigator.locks.request(KEY, async () => {
    const all = read();
    if (command === "create") {
      if (all[storeId]) throw Error("Store address is already taken");
      all[storeId] = emptyStore(actor.uid, data.name, storeId);
      localStorage.setItem(KEY, JSON.stringify(all));
      return { storeId };
    }
    const s = all[storeId];
    if (!s) throw Error("Store not found");
    if (command === "view") return viewStore(s, actor);
    const out = execute(s, actor, command, data, requestId);
    all[storeId] = out.state;
    localStorage.setItem(KEY, JSON.stringify(all));
    return out.result;
  });
}
export async function myStores() {
  if (!demo)
    return (await httpsCallable(functions!, "myStores")({})).data as any[];
  return Object.entries(read())
    .filter(([, s]: any) => s.config.ownerId === actor.uid)
    .map(([id, s]: any) => ({ id, ...s.config }));
}
export async function upload(store: string, file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("Use a PNG, JPEG or WebP image under 5 MB");
  if (!storage)
    throw Error(
      "Image uploads need Firebase Storage. In the demo, use an HTTPS image URL.",
    );
  const r = ref(storage, `stores/${store}/${crypto.randomUUID()}`);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
