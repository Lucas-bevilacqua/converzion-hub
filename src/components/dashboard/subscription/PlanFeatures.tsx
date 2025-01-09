import { Check } from "lucide-react"

interface PlanFeaturesProps {
  features: string[]
}

export const PlanFeatures = ({ features }: PlanFeaturesProps) => {
  return (
    <div className="space-y-3 mb-6">
      {features.map((feature) => (
        <div key={feature} className="flex items-center gap-2">
          <div className="rounded-full p-1 bg-primary/10">
            <Check className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm">{feature}</span>
        </div>
      ))}
    </div>
  )
}