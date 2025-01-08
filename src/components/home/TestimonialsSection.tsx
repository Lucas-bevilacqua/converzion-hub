import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

const testimonials = [
  {
    name: "Carlos Silva",
    role: "CEO da TechSolutions",
    image: "/placeholder.svg",
    quote: "A Converzion transformou completamente nosso atendimento. Aumentamos nossa taxa de conversão em 45% e reduzimos o tempo de resposta para minutos.",
  },
  {
    name: "Ana Paula",
    role: "Gerente de Marketing da E-commerce Plus",
    image: "/placeholder.svg",
    quote: "Implementamos a IA da Converzion e nossos clientes adoraram. O suporte 24/7 nos ajudou a expandir para novos mercados.",
  },
  {
    name: "Roberto Santos",
    role: "Diretor de Vendas da Digital Pro",
    image: "/placeholder.svg",
    quote: "A melhor decisão que tomamos foi usar a Converzion. Nossa equipe consegue focar em estratégia enquanto a IA cuida do atendimento básico.",
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-24 bg-white">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-primary-950">
          Empresas que confiam na Converzion
        </h2>
        <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
          Junte-se a centenas de empresas que já transformaram seu atendimento com nossa tecnologia
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="bg-white border-none shadow-lg hover:shadow-xl transition-all">
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-primary/30 mb-4" />
                <p className="text-gray-600 mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={testimonial.image} alt={testimonial.name} />
                    <AvatarFallback>{testimonial.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-primary-950">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};