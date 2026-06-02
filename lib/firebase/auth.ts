import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { User as AppUser } from "@/lib/types/user";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "../constants";
import { NextRequest } from "next/server";


function generateReferralCode(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}

// ─── Session cookie management ────────────────────────────────────────────────

export async function createSession(idToken: string): Promise<void> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Failed to create session");
}

export async function deleteSession(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
}

// ─── Email / Password ─────────────────────────────────────────────────────────

export async function signUpWithEmail(
  name: string,
  email: string,
  phone: string,
  password: string,
  referralCode?: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { user } = credential;

  await updateProfile(user, { displayName: name });

  const newUser: Omit<AppUser, "id"> = {
    name,
    email,
    phone,
    referralCode: generateReferralCode(user.uid),
    referredBy: referralCode,
    referralBonusAmount: 0,
    // isVerified: false, // KYC removed
    // kycStatus: "unverified", // KYC removed
    role: "user",
    status: "active",
    circleIds: [],
    bankAccounts: [],
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", user.uid), { id: user.uid, ...newUser });

  // Create empty wallet
  await setDoc(doc(db, "wallets", user.uid), {
    userId: user.uid,
    available: 0,
    pending: 0,
    totalSaved: 0,
    totalReceived: 0,
    referralEarnings: 0,
    currency: "NGN",
    updatedAt: serverTimestamp(),
  });

  // Send welcome email (fire-and-forget, never throws)
  fetch("/api/auth/welcome", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  }).catch(console.error);

  const idToken = await user.getIdToken();
  await createSession(idToken);

  return user;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await credential.user.getIdToken();
  await createSession(idToken);
  return credential.user;
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");

  const credential = await signInWithPopup(auth, provider);
  const { user } = credential;


  // Upsert user doc (may be first Google sign-in)
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists()) {
    const newUser: Omit<AppUser, "id"> = {
      name: user.displayName ?? "",
      email: user.email ?? "",
      phone: "",
      avatarUrl: user.photoURL ?? undefined,
      referralCode: generateReferralCode(user.uid),
      referralBonusAmount: 0,
      // isVerified: false, // KYC removed
      // kycStatus: "unverified", // KYC removed
      role: "user",
      status: "active",
      circleIds: [],
      bankAccounts: [],
      onboardingComplete: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", user.uid), { id: user.uid, ...newUser });
    await setDoc(doc(db, "wallets", user.uid), {
      userId: user.uid,
      available: 0,
      pending: 0,
      totalSaved: 0,
      totalReceived: 0,
      referralEarnings: 0,
      currency: "NGN",
      updatedAt: serverTimestamp(),
    });

    fetch("/api/auth/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: user.displayName ?? "", email: user.email ?? "" }),
    }).catch(console.error);
  }

  const idToken = await user.getIdToken();
  await createSession(idToken);
  return user;
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  await deleteSession();
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// ─── Auth state observer ──────────────────────────────────────────────────────

export { onAuthStateChanged, auth };

