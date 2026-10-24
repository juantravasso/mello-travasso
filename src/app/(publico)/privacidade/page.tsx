import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Lista, Secao } from "@/components/publico/DocumentoLegal";
import { MARCA } from "@/lib/marca";
import { OPERADORA, POLITICA } from "@/lib/operadora";

export const metadata: Metadata = {
  title: "Política de Privacidade",
};

const link = "text-primary underline underline-offset-2";

export default function PrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de Privacidade">
      <p>
        Esta Política explica quais dados pessoais a plataforma {MARCA.nome} trata, para quê, com quem compartilha e quais
        são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD). Ela complementa os{" "}
        <Link href="/termos" className={link}>
          Termos de Uso
        </Link>
        .
      </p>

      <Secao titulo="1. Quem é o responsável">
        <p>
          O controlador dos dados de cadastro, de acesso e de cobrança é {OPERADORA.nome}, {OPERADORA.documentoRotulo}{" "}
          {OPERADORA.documento}, {OPERADORA.cidade}/{OPERADORA.uf}. {OPERADORA.nome} também é o encarregado pelo
          tratamento de dados (DPO): {OPERADORA.email}.
        </p>
        <p>
          Sobre os dados de terceiros que você cadastra na gestão (funcionários, fornecedores, clientes), você é o
          controlador e nós tratamos esses dados por sua conta, só para prestar o serviço.
        </p>
      </Secao>

      <Secao titulo="2. Quais dados tratamos">
        <Lista>
          <li>
            <strong>Cadastro:</strong> CNPJ ou CPF, razão social ou nome, nome do responsável, e-mail, telefone,
            endereço e senha (guardada só como hash, nunca em texto simples). O CNPJ preenche dados públicos da empresa.
          </li>
          <li>
            <strong>Uso da gestão:</strong> projetos, contas a pagar e a receber, estoque, funcionários, fornecedores e
            os comprovantes e documentos que você enviar.
          </li>
          <li>
            <strong>Perfil público:</strong> o que você escolher publicar: nome do perfil, descrição, profissões, cidade,
            estado, áreas de atendimento, fotos, portfólio, Instagram, site e, só se você marcar, telefone e WhatsApp.
          </li>
          <li>
            <strong>Recomendações e avaliações:</strong> o conteúdo escrito e o nome de quem escreveu.
          </li>
          <li>
            <strong>Verificação:</strong> se você pedir o selo de verificação, os documentos enviados para comprová-la.
            Ficam cifrados, nunca são exibidos publicamente e os arquivos são apagados depois da análise.
          </li>
          <li>
            <strong>Cobrança:</strong> plano contratado, valores, datas e situação do pagamento. Os dados do cartão
            ficam com o Mercado Pago; nós não os recebemos.
          </li>
          <li>
            <strong>Segurança e funcionamento:</strong> sessão de login, registros de acesso e de ações importantes
            (por exemplo, quem alterou algo na administração) e e-mails de aviso enviados.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="3. Para que usamos (e a base legal)">
        <Lista>
          <li>
            <strong>Prestar o serviço que você contratou</strong> (execução de contrato): criar e proteger a conta, fazer
            a gestão funcionar, ler comprovantes, exibir o perfil que você publicar.
          </li>
          <li>
            <strong>Cobrar e cumprir a lei</strong> (obrigação legal e contrato): emitir cobranças, guardar registros
            exigidos em lei, atender autoridades quando a lei obrigar.
          </li>
          <li>
            <strong>Segurança e prevenção a fraude</strong> (legítimo interesse): limitar tentativas de acesso,
            investigar abuso, moderar conteúdo.
          </li>
          <li>
            <strong>Avisar você</strong> (execução de contrato e legítimo interesse): e-mails sobre teste, cobrança,
            segurança e mudanças no serviço. Não enviamos propaganda de terceiros.
          </li>
          <li>
            <strong>Perfil público e avaliações</strong> (consentimento): só aparecem porque você publicou, e você retira
            o consentimento quando quiser despublicando.
          </li>
        </Lista>
        <p>
          Não vendemos seus dados, não os usamos para publicidade de terceiros e não treinamos modelos de inteligência
          artificial com o conteúdo da sua gestão.
        </p>
      </Secao>

      <Secao titulo="4. Com quem compartilhamos">
        <p>Só com quem precisamos para prestar o serviço (operadores), cada um para a sua função:</p>
        <Lista>
          <li>
            <strong>Vercel</strong> (hospedagem da aplicação) e <strong>Neon</strong> (banco de dados);
          </li>
          <li>
            <strong>Anthropic</strong> (leitura de comprovantes por inteligência artificial): recebe a imagem do
            comprovante que você enviar para leitura;
          </li>
          <li>
            <strong>Mercado Pago</strong> (cobrança e assinatura);
          </li>
          <li>
            <strong>Resend</strong> (envio de e-mails);
          </li>
          <li>
            <strong>BrasilAPI</strong> e <strong>ViaCEP</strong> (consulta pública de CNPJ e de endereço): recebem o CNPJ
            ou o CEP digitado, nada mais.
          </li>
        </Lista>
        <p>
          O que você publica no perfil público é visível a qualquer pessoa. Podemos também compartilhar dados quando a
          lei ou uma ordem judicial exigir, ou para defender direitos em processo.
        </p>
      </Secao>

      <Secao titulo="5. Transferência para fora do Brasil">
        <p>
          Alguns desses provedores guardam ou processam dados fora do Brasil (por exemplo, nos Estados Unidos). Nesses
          casos usamos fornecedores que adotam cláusulas contratuais e medidas de segurança compatíveis com a LGPD.
        </p>
      </Secao>

      <Secao titulo="6. Por quanto tempo guardamos">
        <Lista>
          <li>
            <strong>Conta ativa:</strong> enquanto ela existir.
          </li>
          <li>
            <strong>Depois do cancelamento:</strong> a conta fica em somente leitura e podemos guardar os dados por até{" "}
            {POLITICA.mesesRetencao} meses depois do fim do período pago, para você poder voltar. Depois disso, os dados
            de gestão podem ser apagados.
          </li>
          <li>
            <strong>Exclusão a pedido:</strong> se você pedir, apagamos em até {POLITICA.diasAtendimento} dias.
          </li>
          <li>
            <strong>Obrigações legais:</strong> registros de acesso e dados de cobrança podem ser mantidos pelo prazo que a
            lei exigir, mesmo depois da exclusão da conta.
          </li>
        </Lista>
      </Secao>

      <Secao titulo="7. Seus direitos">
        <p>
          Pelo e-mail {OPERADORA.email} você pode pedir: confirmação de que tratamos seus dados e acesso a eles,
          correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre com quem compartilhamos,
          retirada do consentimento e revisão de decisões automatizadas. Respondemos em até {POLITICA.diasAtendimento}{" "}
          dias. Se não ficar satisfeito, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Secao>

      <Secao titulo="8. Segurança">
        <p>
          Senhas são guardadas com hash; a conexão é cifrada (HTTPS); documentos de verificação são cifrados; o acesso à
          administração exige confirmação de senha; ações administrativas ficam registradas. Nenhum sistema é 100%
          seguro: se houver um incidente que possa causar dano relevante, avisamos você e a ANPD nos termos da lei.
        </p>
      </Secao>

      <Secao titulo="9. Cookies e armazenamento no seu aparelho">
        <p>
          Usamos um cookie de sessão, necessário para você continuar logado (dura até 30 dias ou até você sair), e
          guardamos no seu navegador apenas preferências de uso, como o tema claro ou escuro e as abas favoritas do
          menu. Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.
        </p>
      </Secao>

      <Secao titulo="10. Perfil público e buscadores">
        <p>
          Se você publicar um perfil no {MARCA.produtos.profissionais.nome}, qualquer pessoa pode vê-lo e buscadores podem
          indexá-lo. Você pode despublicar a qualquer momento: a página deixa de abrir e o perfil sai da busca da
          plataforma. Buscadores externos podem demorar para atualizar o que já guardaram, e não controlamos cópias que
          terceiros tenham feito enquanto o perfil estava público.
        </p>
      </Secao>

      <Secao titulo="11. Menores de idade">
        <p>A plataforma é para uso profissional e não é destinada a menores de 18 anos.</p>
      </Secao>

      <Secao titulo="12. Mudanças nesta Política">
        <p>
          Podemos atualizar esta Política. A versão em vigor e a data ficam sempre nesta página, e mudanças relevantes
          são avisadas por e-mail ou na plataforma.
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
