import { Card, CardContent } from "@/components/ui/card"
import { Check } from "lucide-react"

const plans = [
  {
    name: "Starter",
    price: "497,00",
    description: "Perfeito para começar",
    features: [
      "1 Instância",
      "5.000 Interações de IA",
      "Suporte por email",
      "Integração básica com HubSpot",
      "Modelo de IA: GPT-4",
      "Análises básicas",
    ],
    priceId: "price_1QbuUvKkjJ7tububiklS9tAc"
  },
  {
    name: "Professional",
    price: "997,00",
    description: "Para negócios em crescimento",
    features: [
      "3 Instâncias",
      "15.000 Interações de IA",
      "Suporte prioritário",
      "Modelo de IA: GPT-4",
      "Análises avançadas",
      "Treinamento de IA",
    ],
    highlighted: true,
    priceId: "price_1QbuUvKkjJ7tububiklS9tAc"
  }
]

export function PricingSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.priceId} className="p-4">
          <CardContent>
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="text-xl font-bold">{plan.price}</p>
            <p className="text-sm">{plan.description}</p>
            <ul className="mt-2">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
