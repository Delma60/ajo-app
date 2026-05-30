import { create } from "zustand";
import type { User } from "firebase/auth";
import type { User as AppUser } from "@/lib/types/user";

interface AuthState {
  firebaseUser: User | null;
  appUser: AppUser | null;
  isLoading: boolean;
  isInitialized: boolean;

  setFirebaseUser: (user: User | null) => void;
  setAppUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  appUser: null,
  isLoading: true,
  isInitialized: false,

  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setAppUser: (user) => set({ appUser: user }),
  setLoading: (loading) => set({ isLoading: loading }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  reset: () =>
    set({
      firebaseUser: null,
      appUser: null,
      isLoading: false,
      isInitialized: true,
    }),
}));