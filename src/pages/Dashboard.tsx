import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard";
import { AISettingsCard } from "@/components/dashboard/AISettingsCard";
import { InstancesCard } from "@/components/dashboard/InstancesCard";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export default function Dashboard() {
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logout successful",
        description: "You have been logged out successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error logging out",
        description: "There was a problem logging out. Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
        
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