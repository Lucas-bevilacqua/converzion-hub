import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "João Silva",
    role: "CEO, TechStart",
    content: "A plataforma revolucionou nosso atendimento. Reduzimos o tempo de resposta em 80% e aumentamos a satisfação dos clientes.",
    rating: 5,
    image: "/photo-1581092795360-fd1ca04f0952", // Professional man in office chair
  },
  {
    name: "Maria Santos",
    role: "Gerente de Marketing, E-commerce Plus",
    content: "Impressionante como a IA entende o contexto e responde naturalmente. Nossos clientes nem percebem que é um bot.",
    rating: 5,
    image: "/photo-1581091226825-a6a2a5aee158", // Professional woman with laptop
  },
  {
    name: "Pedro Oliveira",
    role: "Diretor Comercial, Vendas.co",
    content: "A melhor decisão que tomamos. O atendimento 24/7 multiplicou nossas conversões e a IA é fantástica na condução das conversas.",
    rating: 5,
    image: "/photo-1486312338219-ce68d2c6f44d", // Professional person with MacBook
  },
];

export const TestimonialSection = () => {
  return (
    <section className="py-24 bg-[#F5F7FA]">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-6 text-[#333333]">
            Histórias de{" "}
            <span className="bg-gradient-to-r from-[#0056D2] to-[#00C896] bg-clip-text text-transparent">
              Sucesso
            </span>
          </h2>
          <p className="text-[#333333]/80 text-lg font-medium">
            Veja como empresas estão transformando seu atendimento com nossa plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="border border-[#333333]/10 bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-[#00C896] mb-4 opacity-50" />
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#FF6B35] text-[#FF6B35]" />
                  ))}
                </div>
                <p className="text-[#333333]/80 mb-6 leading-relaxed font-medium">{testimonial.content}</p>
                <div className="flex items-center gap-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-[#333333]">{testimonial.name}</p>
                    <p className="text-sm text-[#333333]/70">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="p-8 bg-white rounded-lg hover:shadow-lg transition-all">
              <h3 className="text-4xl font-bold text-[#0056D2] mb-2">95%</h3>
              <p className="text-[#333333]/80 font-medium">Satisfação</p>
            </div>
            <div className="p-8 bg-white rounded-lg hover:shadow-lg transition-all">
              <h3 className="text-4xl font-bold text-[#0056D2] mb-2">24/7</h3>
              <p className="text-[#333333]/80 font-medium">Disponibilidade</p>
            </div>
            <div className="p-8 bg-white rounded-lg hover:shadow-lg transition-all">
              <h3 className="text-4xl font-bold text-[#0056D2] mb-2">+40%</h3>
              <p className="text-[#333333]/80 font-medium">Vendas</p>
            </div>
            <div className="p-8 bg-white rounded-lg hover:shadow-lg transition-all">
              <h3 className="text-4xl font-bold text-[#0056D2] mb-2">-80%</h3>
              <p className="text-[#333333]/80 font-medium">Tempo de Resposta</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};