import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard";
import { AISettingsCard } from "@/components/dashboard/AISettingsCard";
import { InstancesCard } from "@/components/dashboard/InstancesCard";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

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