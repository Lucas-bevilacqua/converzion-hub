import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "João Silva",
    role: "CEO, TechStart",
    content: "A plataforma revolucionou nosso atendimento. Reduzimos o tempo de resposta em 80% e aumentamos a satisfação dos clientes.",
    rating: 5,
    image: "https://i.pravatar.cc/150?img=1",
  },
  {
    name: "Maria Santos",
    role: "Gerente de Marketing, E-commerce Plus",
    content: "Impressionante como a IA entende o contexto e responde naturalmente. Nossos clientes nem percebem que é um bot.",
    rating: 5,
    image: "https://i.pravatar.cc/150?img=2",
  },
  {
    name: "Pedro Oliveira",
    role: "Diretor Comercial, Vendas.co",
    content: "A melhor decisão que tomamos. O atendimento 24/7 multiplicou nossas conversões e a IA é fantástica na condução das conversas.",
    rating: 5,
    image: "https://i.pravatar.cc/150?img=3",
  },
];

export const TestimonialSection = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            Histórias de Sucesso
          </h2>
          <p className="text-gray-600 text-lg">
            Veja como empresas estão transformando seu atendimento com nossa plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-primary/20 mb-4" />
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6 leading-relaxed">{testimonial.content}</p>
                <div className="flex items-center gap-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-12 w-12 rounded-full"
                  />
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="p-8 bg-primary-50 rounded-lg hover:shadow-lg transition-all">
              <h3 className="text-4xl font-bold text-primary-800 mb-2">95%</h3>
              <p className="text-gray-600">Satisfação</p>
            </div>
            <div className="p-8 bg-primary-50 rounded-lg hover:shadow-lg transition-all">
              <h3 className="text-4xl font-bold text-primary-800 mb-2">24/7</h3>
              <p className="text-gray-600">Disponibilidade</p>
            </div>
            <div className="p-8 bg-primary-50 rounded-lg hover:shadow-lg transition-all">
              <h3 className="text-4xl font-bold text-primary-800 mb-2">+40%</h3>
              <p className="text-gray-600">Vendas</p>
            </div>
            <div className="p-8 bg-primary-50 rounded-lg hover:shadow-lg transition-all">
              <h3 className="text-4xl font-bold text-primary-800 mb-2">-80%</h3>
              <p className="text-gray-600">Tempo de Resposta</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};