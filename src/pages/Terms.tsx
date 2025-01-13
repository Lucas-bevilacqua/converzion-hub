import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container py-16 mt-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Termos de Uso</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="lead mb-8">
              Última atualização: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e usar o Converzion, você concorda com estes Termos de Uso e nossa Política de Privacidade.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Descrição do Serviço</h2>
              <p>
                O Converzion é uma plataforma de atendimento automatizado que utiliza inteligência artificial para gerenciar conversas com clientes através do WhatsApp e outros canais.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Conta de Usuário</h2>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Você é responsável por manter a confidencialidade de sua conta</li>
                <li>Informações fornecidas devem ser precisas e atualizadas</li>
                <li>Uma conta não pode ser compartilhada entre múltiplos usuários</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Uso do Serviço</h2>
              <p>Você concorda em:</p>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Não usar o serviço para fins ilegais</li>
                <li>Não tentar acessar áreas restritas do sistema</li>
                <li>Não interferir com a segurança do serviço</li>
                <li>Não enviar conteúdo malicioso ou spam</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Pagamentos e Reembolsos</h2>
              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Pagamentos são processados mensalmente</li>
                <li>Reembolsos podem ser solicitados em até 7 dias</li>
                <li>Cancelamentos devem ser feitos com 30 dias de antecedência</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo e software do Converzion são protegidos por direitos autorais e outras leis de propriedade intelectual.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Limitação de Responsabilidade</h2>
              <p>
                O Converzion não se responsabiliza por danos indiretos, incidentais ou consequentes resultantes do uso do serviço.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Modificações dos Termos</h2>
              <p>
                Reservamos o direito de modificar estes termos a qualquer momento, notificando os usuários sobre mudanças significativas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Contato</h2>
              <p>
                Para questões sobre os termos de uso:
                <br />
                Email: legal@converzion.com.br
                <br />
                Telefone: (11) 99999-9999
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;