import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Lista, Secao } from "@/components/publico/DocumentoLegal";
import { MARCA } from "@/lib/marca";
import { OPERADORA, POLITICA } from "@/lib/operadora";

export const metadata: Metadata = {
  title: "Termos de Uso",
};

const link = "text-primary underline underline-offset-2";

export default function TermosPage() {
  return (
    <DocumentoLegal titulo="Termos de Uso">
      <p>
        Estes Termos regulam o uso da plataforma {MARCA.nome} (&ldquo;plataforma&rdquo;), oferecida por {OPERADORA.nome},{" "}
        {OPERADORA.documentoRotulo} {OPERADORA.documento}, com sede em {OPERADORA.cidade}/{OPERADORA.uf}{" "}
        (&ldquo;nós&rdquo;), à pessoa ou empresa que criar uma conta (&ldquo;você&rdquo;). Ao criar a conta você declara
        que leu e aceita estes Termos e a{" "}
        <Link href="/privacidade" className={link}>
          Política de Privacidade
        </Link>
        .
      </p>

      <Secao titulo="1. O que a plataforma oferece">
        <Lista>
          <li>
            <strong>{MARCA.produtos.gestao.nome}:</strong> contas a pagar e a receber, projetos, estoque, funcionários,
            fornecedores, calendário e captura de documentos com leitura por inteligência artificial.
          </li>
          <li>
            <strong>{MARCA.produtos.profissionais.nome}:</strong> perfil público, busca de empresas e autônomos,
            portfólio, recomendações e avaliações.
          </li>
          <li>
            A área de compra e venda ({MARCA.produtos.marketplace.nome}) ainda não foi lançada e não faz parte do que
            está contratado hoje.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="2. Sua conta">
        <p>
          Você informa dados verdadeiros e atualizados e mantém a senha em sigilo. O que acontece na conta, inclusive
          por pessoas que você convidar, é de sua responsabilidade. Se suspeitar de acesso indevido, troque a senha e
          avise-nos pelo e-mail {OPERADORA.email}. A conta é de uso profissional ou empresarial; não é permitido
          repassar o acesso a terceiros de fora da sua equipe.
        </p>
      </Secao>

      <Secao titulo="3. Período de teste e plano de assinatura">
        <p>
          Contas novas têm um período de teste gratuito, informado no cadastro, sem pedir cartão. Terminado o teste sem
          uma assinatura ativa, a conta passa a <strong>somente leitura</strong>: você continua consultando o que já
          cadastrou, mas não faz novos lançamentos. Os planos, valores e condições vigentes ficam na página de planos
          dentro da plataforma e valem como oferta no momento da contratação.
        </p>
      </Secao>

      <Secao titulo="4. Pagamento">
        <p>
          A cobrança é feita pelo Mercado Pago. Os planos podem ser contratados no ciclo <strong>mensal</strong>{" "}
          (assinatura recorrente, cobrada todo mês no cartão) ou <strong>anual</strong> (pagamento único pelo período de
          12 meses, que pode ser parcelado conforme a oferta exibida no pagamento). Não temos acesso aos dados completos
          do seu cartão. O plano anual não renova sozinho: perto do vencimento avisamos por e-mail e você decide se
          renova.
        </p>
        <p>
          Planos com número limitado de vagas (como o plano Fundador) têm a vaga reservada por um curto tempo durante o
          pagamento; se o pagamento não for confirmado nesse prazo, a vaga volta para a fila.
        </p>
        <p>
          Quem assina um plano com preço de fundador mantém esse preço enquanto a assinatura continuar ativa. Se a
          assinatura for encerrada e a pessoa voltar depois, vale o preço e a disponibilidade da oferta daquele momento.
        </p>
        <p>
          Se precisarmos reajustar o preço de quem já assina, avisamos por e-mail com pelo menos{" "}
          {POLITICA.diasAvisoReajuste} dias de antecedência; o novo valor só vale a partir da próxima cobrança depois
          desse aviso, e você pode cancelar antes sem custo.
        </p>
      </Secao>

      <Secao titulo="5. Cancelamento e reembolso">
        <Lista>
          <li>
            <strong>Você pode cancelar quando quiser</strong>, sem multa e sem taxa, pelo e-mail {OPERADORA.email} ou
            diretamente na sua assinatura no Mercado Pago.
          </li>
          <li>
            <strong>Você mantém o acesso até o fim do período que já pagou.</strong> Cancelar interrompe as próximas
            cobranças; não corta o mês (ou o ano) já pago. Ao fim do período a conta passa a somente leitura.
          </li>
          <li>
            <strong>Arrependimento:</strong> nos primeiros {POLITICA.diasArrependimento} dias corridos depois de
            contratar um plano pago você pode pedir o <strong>reembolso integral</strong> (Código de Defesa do
            Consumidor, art. 49). Basta escrever para {OPERADORA.email}. O valor volta pelo mesmo meio de pagamento.
            Nesse caso o acesso pago é encerrado na data do reembolso.
          </li>
          <li>
            Passado esse prazo não há devolução proporcional do período já pago, mas ele continua valendo até o fim,
            como descrito acima.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="6. O que acontece com seus dados depois do cancelamento">
        <p>
          Com a conta em somente leitura você continua consultando seus dados. Podemos manter os dados
          guardados por até {POLITICA.mesesRetencao} meses depois do fim do período pago, para que você possa voltar sem
          perder nada. Passado esse prazo, os dados de gestão (projetos, contas, estoque, funcionários, fornecedores,
          comprovantes) podem ser apagados. Se você preferir, peça a exclusão antes, e atendemos em até{" "}
          {POLITICA.diasAtendimento} dias. Obrigações legais de guarda (como registros de acesso e dados de cobrança)
          seguem os prazos da lei. Detalhes na{" "}
          <Link href="/privacidade" className={link}>
            Política de Privacidade
          </Link>
          .
        </p>
      </Secao>

      <Secao titulo="7. Seus dados e o que fazemos com eles">
        <p>
          Os dados que você cadastra continuam sendo seus. Usamos só para fazer a plataforma funcionar para você, nos
          termos da Política de Privacidade. Você é responsável por ter o direito de cadastrar dados de terceiros
          (funcionários, fornecedores, clientes) e de enviar os documentos que enviar.
        </p>
      </Secao>

      <Secao titulo="8. Leitura de documentos por inteligência artificial">
        <p>
          A captura de comprovantes usa inteligência artificial para sugerir os campos de um lançamento. A leitura pode
          errar. <strong>Confira os dados antes de confirmar</strong>: o lançamento é de sua responsabilidade, e a
          plataforma não substitui a conferência contábil ou fiscal.
        </p>
      </Secao>

      <Secao titulo={`9. Perfil público, recomendações e avaliações (${MARCA.produtos.profissionais.nome})`}>
        <Lista>
          <li>
            O perfil nasce como rascunho e só fica público quando você publica. O que você marcar como público pode ser
            visto por qualquer pessoa e indexado por buscadores. Dados de gestão nunca entram no perfil.
          </li>
          <li>
            Você responde pelo que publica (textos, fotos, portfólio, avaliações). Não publique conteúdo falso,
            ofensivo, ilegal, que viole direito autoral ou de imagem, nem avaliações de quem você não contratou ou que
            você não recebeu como cliente.
          </li>
          <li>
            Podemos moderar: ocultar ou remover conteúdo, despublicar perfis e suspender contas que violem estes Termos
            ou a lei, e podemos fazer isso sem aviso quando houver risco a terceiros. Sempre que possível explicamos o
            motivo.
          </li>
          <li>
            A plataforma conecta pessoas e empresas; <strong>não faz parte dos contratos</strong> entre quem presta e
            quem contrata um serviço e não garante a qualidade, o preço ou o cumprimento do que for combinado. Selos e
            avaliações são informações de apoio, não uma certificação.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="10. Uso aceitável">
        <p>
          Não é permitido tentar acessar contas de outras pessoas, burlar limites ou a segurança, usar robôs para
          extrair dados, enviar código malicioso, sobrecarregar o serviço ou usar a plataforma para atividades ilegais.
          Podemos suspender a conta que fizer isso.
        </p>
      </Secao>

      <Secao titulo="11. Disponibilidade e limite de responsabilidade">
        <p>
          Trabalhamos para manter a plataforma no ar, mas não garantimos funcionamento ininterrupto nem ausência de erros. Podemos ter paradas para manutenção e instabilidades de provedores
          externos. Na extensão permitida pela lei, nossa responsabilidade se limita aos valores que você pagou nos 12
          meses anteriores ao fato, e não respondemos por lucros cessantes, decisões tomadas com base nos dados da
          plataforma ou perdas causadas por conteúdo de terceiros. Isso não afasta direitos que a lei garante ao
          consumidor.
        </p>
      </Secao>

      <Secao titulo="12. Propriedade intelectual">
        <p>
          O software, a marca {MARCA.nome} e o conteúdo da plataforma são nossos. Você recebe um direito de uso pessoal,
          não exclusivo e não transferível enquanto a conta existir. O conteúdo que você publica continua sendo seu; ao
          publicá-lo você nos autoriza a exibi-lo na plataforma, conforme as opções de visibilidade que escolheu.
        </p>
      </Secao>

      <Secao titulo="13. Mudanças nestes Termos">
        <p>
          Podemos atualizar estes Termos. Mudanças relevantes são avisadas por e-mail ou na plataforma com antecedência
          razoável, e a versão em vigor fica sempre nesta página, com a data. Continuar usando depois do aviso significa
          aceitar a nova versão; se não concordar, você pode cancelar nas condições da seção 5.
        </p>
      </Secao>

      <Secao titulo="14. Lei aplicável, foro e contato">
        <p>
          Estes Termos seguem a lei brasileira. Para resolver qualquer conflito fica eleito o foro da comarca do{" "}
          {OPERADORA.cidade}/{OPERADORA.uf}, sem prejuízo do direito do consumidor de acionar o foro do seu próprio
          domicílio. Dúvidas, pedidos de cancelamento, reembolso ou reclamações: {OPERADORA.email}.
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
