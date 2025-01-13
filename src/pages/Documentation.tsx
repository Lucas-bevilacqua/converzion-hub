import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, MessageSquare, Calendar, Users } from "lucide-react";

const Documentation = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container py-16 mt-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Documentação</h1>
          
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Introdução</h2>
              <p className="text-gray-600 mb-4">
                Bem-vindo à documentação do Converzion! Aqui você encontrará todas as informações necessárias para começar a usar nossa plataforma de atendimento automatizado com IA.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Funcionalidades Principais</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <Bot className="w-8 h-8 text-primary mb-2" />
                    <CardTitle>Atendimento com IA</CardTitle>
                    <CardDescription>
                      Automatize seu atendimento com inteligência artificial avançada
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Nossa IA é treinada para entender e responder perguntas de forma natural e eficiente.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <MessageSquare className="w-8 h-8 text-primary mb-2" />
                    <CardTitle>Multi-canais</CardTitle>
                    <CardDescription>
                      Integração com diversos canais de comunicação
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Gerencie conversas do WhatsApp e outros canais em uma única plataforma.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Calendar className="w-8 h-8 text-primary mb-2" />
                    <CardTitle>Agendamento</CardTitle>
                    <CardDescription>
                      Sistema de agendamento integrado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Permita que seus clientes agendem horários diretamente pelo chat.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Users className="w-8 h-8 text-primary mb-2" />
                    <CardTitle>CRM Integrado</CardTitle>
                    <CardDescription>
                      Gestão completa de clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      Mantenha todos os dados dos seus clientes organizados e acessíveis.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Primeiros Passos</h2>
              <ol className="list-decimal list-inside space-y-4 text-gray-600">
                <li>Crie sua conta na plataforma</li>
                <li>Configure seu primeiro bot de atendimento</li>
                <li>Conecte com seu WhatsApp Business</li>
                <li>Personalize as respostas da IA</li>
                <li>Comece a atender seus clientes automaticamente</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Suporte</h2>
              <p className="text-gray-600 mb-4">
                Precisa de ajuda? Nossa equipe está sempre disponível para auxiliar você.
              </p>
              <Button variant="outline" className="mr-4">
                Central de Ajuda
              </Button>
              <Button>Falar com Suporte</Button>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Documentation;