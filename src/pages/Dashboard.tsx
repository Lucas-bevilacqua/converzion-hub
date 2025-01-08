import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard";
import { AISettingsCard } from "@/components/dashboard/AISettingsCard";
import { InstancesCard } from "@/components/dashboard/InstancesCard";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          <SubscriptionCard />
          <AISettingsCard />
          <div className="md:col-span-2">
            <InstancesCard />
          </div>
        </div>
      </div>
    </div>
  );
}