'use client'
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { getUserProfile } from "@/lib/firebase/firestore";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { user, isLoading: loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = React.useState<
    boolean | null
  >(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
      return;
    }
    if (user) {
      (async () => {
        const profile = await getUserProfile(user.uid);
        if (!profile?.onboardingComplete) {
          setOnboardingComplete(false);
          router.replace("/onboarding");
        } else {
          setOnboardingComplete(true);
        }
      })();
    }
  }, [user, loading, router]);

  if (loading || onboardingComplete === null) {
    return <div>Loading...</div>;
  }

  return <div>{children}</div>;
};

export default Layout;
