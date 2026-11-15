// Firestore data: budget/{uid} (profile, learned merchant rules, advice)
// and budget/{uid}/tx/{id} (one document per transaction).
import { db, fs } from "./firebase.js";

const ROOT = "budget";
const { doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, getDocFromServer, deleteField } = fs;

export function describeError(e) {
  const code = e?.code ?? "";
  const message = String(e?.message ?? "");
  if (code === "permission-denied") return "Serwer odrzucił dostęp do bazy (reguły Firestore).";
  if (code === "unavailable" || code === "timeout") return "Brak połączenia z bazą. Zmiany zapiszą się, gdy wróci internet.";
  if (/app.?check/i.test(message)) return "AI odrzuciło zapytanie (App Check). Odśwież stronę i spróbuj ponownie.";
  if (/quota|429|resource.?exhausted/i.test(message)) return "Przekroczony darmowy limit zapytań do AI — spróbuj za chwilę.";
  return message || "Coś poszło nie tak.";
}

/** Live data for a user; calls onChange({meta, txs, pending, error}). */
export function subscribe(uid, onChange) {
  const state = { meta: null, metaLoaded: false, txs: [], txLoaded: false, pending: false, error: null };
  let metaPending = false;
  let txPending = false;
  const emit = () => onChange({ ...state, loading: !(state.metaLoaded && state.txLoaded) });
  const fail = (e) => {
    console.error(e);
    state.error = describeError(e);
    state.metaLoaded = state.txLoaded = true;
    emit();
  };
  const u1 = onSnapshot(
    doc(db, ROOT, uid),
    { includeMetadataChanges: true },
    (snap) => {
      metaPending = snap.metadata.hasPendingWrites;
      state.meta = snap.data() ?? {};
      state.metaLoaded = true;
      state.pending = metaPending || txPending;
      emit();
    },
    fail,
  );
  const u2 = onSnapshot(
    collection(db, ROOT, uid, "tx"),
    { includeMetadataChanges: true },
    (snap) => {
      txPending = snap.metadata.hasPendingWrites;
      state.txs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      state.txLoaded = true;
      state.pending = metaPending || txPending;
      emit();
    },
    fail,
  );
  return () => {
    u1();
    u2();
  };
}

export async function checkServer(uid) {
  return Promise.race([
    getDocFromServer(doc(db, ROOT, uid)),
    new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "timeout" })), 12000)),
  ]);
}

export const newId = () => doc(collection(db, "_")).id;

/** Replaces the given top-level fields (e.g. {profile}) and keeps the rest. */
export function saveMeta(uid, patch) {
  return setDoc(doc(db, ROOT, uid), patch, { mergeFields: Object.keys(patch) });
}

/** Sets learned["merchant key"] = category (or removes it with null). */
export function learn(uid, key, category) {
  if (!key) return Promise.resolve();
  return updateDoc(doc(db, ROOT, uid), { [`learned.${key}`]: category ?? deleteField() }).catch(() =>
    setDoc(doc(db, ROOT, uid), { learned: { [key]: category } }, { merge: true }),
  );
}

export function saveTx(uid, tx) {
  const { id, ...data } = tx;
  return setDoc(doc(db, ROOT, uid, "tx", id ?? newId()), data);
}

export function patchTx(uid, id, patch) {
  return updateDoc(doc(db, ROOT, uid, "tx", id), patch);
}

export async function saveTxs(uid, txs) {
  for (let i = 0; i < txs.length; i += 400) {
    const batch = writeBatch(db);
    for (const t of txs.slice(i, i + 400)) {
      const { id, ...data } = t;
      batch.set(doc(db, ROOT, uid, "tx", id ?? newId()), data);
    }
    await batch.commit();
  }
}

export async function patchTxs(uid, patches) {
  for (let i = 0; i < patches.length; i += 400) {
    const batch = writeBatch(db);
    for (const { id, patch } of patches.slice(i, i + 400)) batch.update(doc(db, ROOT, uid, "tx", id), patch);
    await batch.commit();
  }
}

export function deleteTx(uid, id) {
  return deleteDoc(doc(db, ROOT, uid, "tx", id));
}

export async function deleteAll(uid, txs) {
  for (let i = 0; i < txs.length; i += 400) {
    const batch = writeBatch(db);
    for (const t of txs.slice(i, i + 400)) batch.delete(doc(db, ROOT, uid, "tx", t.id));
    await batch.commit();
  }
  await deleteDoc(doc(db, ROOT, uid));
}
