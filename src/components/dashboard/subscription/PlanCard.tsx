import { Button } from "@/components/ui/button"
import { PlanFeatures } from "./PlanFeatures"

interface PlanCardProps {
  name: string
  price: string
  description: string
  features: string[]
  highlighted?: boolean
  onSelect: () => void
  buttonText?: string
}

export const PlanCard = ({ 
  name, 
  price, 
  description, 
  features, 
  highlighted = false,
  onSelect,
  buttonText = "Começar Agora"
}: PlanCardProps) => {
  return (
    <div
      className={`relative rounded-lg border p-6 ${
        highlighted
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-4 bg-primary px-3 py-1 rounded-full">
          <span className="text-xs font-medium text-primary-foreground">
            Mais Popular
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {description}
        </p>
        <div className="mt-2 flex items-baseline">
          <span className="text-2xl font-bold">R$</span>
          <span className="text-4xl font-bold">{price}</span>
          <span className="text-muted-foreground">/mês</span>
        </div>
      </div>

      <PlanFeatures features={features} />

      <Button
        onClick={onSelect}
        className="w-full"
        variant={highlighted ? 'default' : 'outline'}
      >
        {buttonText}
      </Button>
    </div>
  )
}