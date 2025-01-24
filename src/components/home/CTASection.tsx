import { Check, ArrowRight } from "lucide-react"

export function CTASection() {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-background">
      <h2 className="text-2xl font-bold">Transforme sua comunicação</h2>
      <p className="mt-2 text-center text-muted-foreground">
        Aumente a eficiência do seu atendimento com nosso sistema de follow-up automatizado.
      </p>
      <div className="mt-4 flex gap-2">
        <button className="flex items-center px-4 py-2 text-white bg-primary rounded-md">
          <Check className="mr-2" />
          Comece agora
        </button>
        <button className="flex items-center px-4 py-2 text-primary border border-primary rounded-md">
          <ArrowRight className="mr-2" />
          Saiba mais
        </button>
      </div>
    </div>
  )
}
