import { Crown } from "lucide-react"

export const TrialBadge = ({ daysRemaining }: { daysRemaining: number }) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-600 text-sm font-medium animate-float">
      <Crown className="h-4 w-4" />
      {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} restantes do trial Professional
    </div>
  )
}