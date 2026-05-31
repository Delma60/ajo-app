import { create } from "zustand";

interface UIStoreState {
	sidebarOpen: boolean;
	setSidebarOpen: (open: boolean) => void;
	modal: string | null;
	openModal: (modal: string) => void;
	closeModal: () => void;
	layout: "default" | "dashboard" | "admin";
	setLayout: (layout: "default" | "dashboard" | "admin") => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
	sidebarOpen: false,
	setSidebarOpen: (open) => set({ sidebarOpen: open }),
	modal: null,
	openModal: (modal) => set({ modal }),
	closeModal: () => set({ modal: null }),
	layout: "default",
	setLayout: (layout) => set({ layout }),
}));