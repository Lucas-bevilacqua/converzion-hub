import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { TestimonialSection } from "@/components/home/TestimonialSection";
import { CTASection } from "@/components/home/CTASection";

export default function Index() {
  const { toast } = useToast();

  const testFollowUp = async () => {
    try {
      console.log('🚀 Iniciando teste de follow-up');
      
      const { data, error } = await supabase.functions.invoke('get-follow-up-contacts', {
        body: { scheduled: true }
      });

      if (error) {
        console.error('❌ Erro ao executar follow-up:', error);
        throw error;
      }

      console.log('✅ Resposta do follow-up:', data);
      
      toast({
        title: "Sucesso!",
        description: "Follow-up executado com sucesso. Verifique os logs para mais detalhes.",
      });
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      toast({
        title: "Erro",
        description: "Falha ao executar follow-up. Verifique os logs para mais detalhes.",
        variant: "destructive",
      });
    }
  };

  return (
    <main>
      <div className="relative">
        <HeroSection />
        <div className="absolute top-4 right-4">
          <Button 
            onClick={testFollowUp}
            variant="outline"
            className="bg-white/90 hover:bg-white"
          >
            Testar Follow-up
          </Button>
        </div>
      </div>
      <FeaturesSection />
      <TestimonialSection />
      <CTASection />
    </main>
  );
}