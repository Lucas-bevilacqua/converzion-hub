import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { TestimonialSection } from "@/components/home/TestimonialSection";
import { CTASection } from "@/components/home/CTASection";
import { PricingSection } from "@/components/home/PricingSection";
import { Header } from "@/components/layout/Header";

export default function Index() {
  return (
    <main>
      <Header />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <TestimonialSection />
      <CTASection />
    </main>
  );
}