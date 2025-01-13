import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, MessageSquare, Calendar, Users, Brain, BarChart, Lock, Zap } from "lucide-react";

const Features = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container py-16 mt-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Funcionalidades</h1>
          <p className="text-xl text-gray-600 mb-12">
            Descubra todas as ferramentas poderosas que o Converzion oferece para transformar seu atendimento
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Bot className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Atendimento Inteligente</CardTitle>
                <CardDescription>
                  IA treinada para entender e responder seus clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Respostas personalizadas e contextuais</li>
                  <li>• Aprendizado contínuo</li>
                  <li>• Suporte 24/7 automatizado</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Brain className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Personalização Avançada</CardTitle>
                <CardDescription>
                  Configure a IA de acordo com seu negócio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Treinamento personalizado</li>
                  <li>• Ajuste de tom e personalidade</li>
                  <li>• Regras de negócio customizáveis</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Calendar className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Sistema de Agendamento</CardTitle>
                <CardDescription>
                  Gestão completa de horários e compromissos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Agendamento automático</li>
                  <li>• Sincronização com Google Calendar</li>
                  <li>• Lembretes automáticos</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-primary mb-2" />
                <CardTitle>CRM Integrado</CardTitle>
                <CardDescription>
                  Gestão completa de relacionamento com clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Histórico de conversas</li>
                  <li>• Segmentação de clientes</li>
                  <li>• Análise de comportamento</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Analytics Detalhado</CardTitle>
                <CardDescription>
                  Métricas e insights para seu negócio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Dashboard em tempo real</li>
                  <li>• Relatórios personalizados</li>
                  <li>• Métricas de desempenho</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Lock className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Segurança Avançada</CardTitle>
                <CardDescription>
                  Proteção total dos seus dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Criptografia end-to-end</li>
                  <li>• Backup automático</li>
                  <li>• Conformidade com LGPD</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Features;