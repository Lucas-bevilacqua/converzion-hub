import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "João Silva",
    role: "CEO, TechStart",
    content: "A plataforma revolucionou nosso atendimento. Reduzimos o tempo de resposta em 80% e aumentamos a satisfação dos clientes.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80",
  },
  {
    name: "Maria Santos",
    role: "Gerente de Marketing, E-commerce Plus",
    content: "Impressionante como a IA entende o contexto e responde naturalmente. Nossos clientes nem percebem que é um bot.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80",
  },
  {
    name: "Pedro Oliveira",
    role: "Diretor Comercial, Vendas.co",
    content: "A melhor decisão que tomamos. O atendimento 24/7 multiplicou nossas conversões e a IA é fantástica na condução das conversas.",
    rating: 5,
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80",
  },
];

export const TestimonialSection = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-[#E5DEFF] via-white to-[#F2FCE2] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10" />
      
      <div className="container relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-6">
            Histórias de{" "}
            <span className="bg-gradient-to-r from-[#9b87f5] to-[#8B5CF6] bg-clip-text text-transparent">
              Sucesso
            </span>
          </h2>
          <p className="text-[#7E69AB] text-lg font-medium">
            Veja como empresas estão transformando seu atendimento com nossa plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card 
              key={testimonial.name} 
              className="border-0 bg-white/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
            >
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-[#9b87f5] mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#0EA5E9] text-[#0EA5E9]" />
                  ))}
                </div>
                <p className="text-[#7E69AB] mb-6 leading-relaxed font-medium">{testimonial.content}</p>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden ring-2 ring-[#9b87f5]/20 group-hover:ring-[#9b87f5] transition-all">
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-[#7E69AB] group-hover:text-[#9b87f5] transition-colors">{testimonial.name}</p>
                    <p className="text-sm text-[#7E69AB]/70">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="p-8 bg-white/50 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 border-0">
              <h3 className="text-4xl font-bold text-[#9b87f5] mb-2">95%</h3>
              <p className="text-[#7E69AB] font-medium">Satisfação</p>
            </div>
            <div className="p-8 bg-white/50 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 border-0">
              <h3 className="text-4xl font-bold text-[#9b87f5] mb-2">24/7</h3>
              <p className="text-[#7E69AB] font-medium">Disponibilidade</p>
            </div>
            <div className="p-8 bg-white/50 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 border-0">
              <h3 className="text-4xl font-bold text-[#9b87f5] mb-2">+40%</h3>
              <p className="text-[#7E69AB] font-medium">Vendas</p>
            </div>
            <div className="p-8 bg-white/50 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 border-0">
              <h3 className="text-4xl font-bold text-[#9b87f5] mb-2">-80%</h3>
              <p className="text-[#7E69AB] font-medium">Tempo de Resposta</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};