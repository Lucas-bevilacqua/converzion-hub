import { Zap, ArrowRight, Bot, Shield } from "lucide-react"

export function HeroSection() {
  return (
    <div className="relative overflow-hidden bg-gray-900">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Transforme sua comunicação
          </h2>
          <p className="mt-4 text-lg text-gray-300">
            Aumente a eficiência do seu negócio com nosso assistente de IA.
          </p>
          <div className="mt-8">
            <a
              href="#"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              Comece agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
      <div className="absolute inset-0">
        <div className="bg-gray-800 opacity-50" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Bot className="h-16 w-16 text-white" />
      </div>
      <div className="absolute bottom-0 right-0 p-4">
        <Shield className="h-8 w-8 text-white" />
      </div>
      <div className="absolute top-0 left-0 p-4">
        <Zap className="h-8 w-8 text-white" />
      </div>
    </div>
  )
}
