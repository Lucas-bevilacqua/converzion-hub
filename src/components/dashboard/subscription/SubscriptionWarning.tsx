import { AlertTriangle } from "lucide-react"

export function SubscriptionWarning() {
  return (
    <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <AlertTriangle className="h-5 w-5 text-yellow-500" />
      <p className="text-sm text-yellow-700">
        Você precisa de uma assinatura ativa para usar as instâncias
      </p>
    </div>
  )
}