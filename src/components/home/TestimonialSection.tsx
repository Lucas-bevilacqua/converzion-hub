import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "João Silva",
    role: "CEO, TechStart",
    content: "A Converzion revolucionou nosso atendimento. Reduzimos o tempo de resposta em 80% e aumentamos a satisfação dos clientes.",
    rating: 5,
  },
  {
    name: "Maria Santos",
    role: "Gerente de Marketing, E-commerce Plus",
    content: "Impressionante como a IA entende o contexto e responde de forma natural. Nossos clientes nem percebem que é um bot.",
    rating: 5,
  },
  {
    name: "Pedro Oliveira",
    role: "Diretor Comercial, Vendas.co",
    content: "Aumentamos nossas vendas em 40% com o atendimento 24/7. O ROI foi positivo já no primeiro mês.",
    rating: 5,
  },
];

export const TestimonialSection = () => {
  return (
    <section className="py-24 bg-gray-50">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-6">
            O que nossos clientes dizem
          </h2>
          <p className="text-gray-600 text-lg">
            Junte-se a centenas de empresas que já transformaram seu atendimento
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="border-none shadow-lg">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">{testimonial.content}</p>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};