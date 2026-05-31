import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { app } from "@/lib/firebase/client";

const db = getFirestore(app);

// Get user profile by UID
export async function getUserProfile(uid: string) {
	const ref = doc(db, "users", uid);
	const snap = await getDoc(ref);
	return snap.exists() ? snap.data() : null;
}

// Real-time snapshot stream
export function subscribeToDoc(path: string, cb: (data: any) => void) {
	const ref = doc(db, path);
	return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
}

// Standardized mutation (set or update)
export async function setDocument(path: string, data: any, merge = true) {
	const ref = doc(db, path);
	await setDoc(ref, data, { merge });
}

export async function updateDocument(path: string, data: any) {
	const ref = doc(db, path);
	await updateDoc(ref, data);
}

// Query collection
export async function queryCollection(col: string, filters: any[] = []) {
	let q = query(collection(db, col), ...filters.map(([field, op, value]) => where(field, op, value)));
	const snap = await getDocs(q);
	return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}