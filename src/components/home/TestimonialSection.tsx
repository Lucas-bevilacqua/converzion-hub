import { Quote, Star } from "lucide-react"

const testimonials = [
  {
    id: 1,
    name: "Lucas Obevi",
    role: "CEO, Company",
    content: "This service has transformed our business!",
    rating: 5,
  },
  {
    id: 2,
    name: "Maria Silva",
    role: "Marketing Director, Another Company",
    content: "Incredible experience and support!",
    rating: 4,
  },
  {
    id: 3,
    name: "John Doe",
    role: "Product Manager, Tech Company",
    content: "Highly recommend to anyone looking for quality!",
    rating: 5,
  },
];

export function TestimonialSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-center mb-8">What Our Clients Say</h2>
      <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2">
        {testimonials.map((testimonial) => (
          <div key={testimonial.id} className="p-6 border rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="ml-2 text-lg font-semibold">{testimonial.name}</span>
            </div>
            <p className="text-gray-700">{testimonial.content}</p>
            <p className="text-sm text-gray-500">{testimonial.role}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
