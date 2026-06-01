import { RewardsContent } from "@/components/rewards/rewards-content";

export const metadata = {
  title: "Rewards & Events",
  description: "Earn badges and rewards by completing savings milestones",
};

export default function RewardsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <RewardsContent />
    </div>
  );
}
