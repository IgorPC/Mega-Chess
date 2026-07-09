import { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TERMS_VERSION } from '../lib/terms';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--color-primary)' }}>{title}</h2>
      <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

export function TermsPage() {
  const { acceptTerms, logout } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    if (!checked) return;
    setLoading(true);
    setError('');
    try {
      await acceptTerms();
    } catch {
      setError('Erro ao registrar aceite. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Termos de Uso e Política de Privacidade</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-dim)', marginTop: 4 }}>
          Versão {TERMS_VERSION} · Para continuar usando a Mega Chess Online, leia e aceite os termos abaixo.
        </p>
      </div>

      <Card style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        <Section title="1. Aceitação dos termos">
          <p>
            Ao criar uma conta ou continuar usando a plataforma Mega Chess Online ("Plataforma"), você declara que leu,
            compreendeu e concorda integralmente com estes Termos de Uso e com a Política de Privacidade aqui descrita.
            O aceite é obrigatório após o login e deve ser renovado sempre que os termos forem atualizados de forma relevante.
          </p>
          <p>
            Você declara ter no mínimo 18 anos de idade. Contas de menores de idade não são permitidas, e operações
            financeiras (depósitos e saques) exigem verificação de maioridade a cada depósito, independentemente de
            dados já cadastrados.
          </p>
        </Section>

        <Section title="2. Proteção de dados pessoais (LGPD)">
          <p>
            A Mega Chess Online atua como controladora dos dados pessoais tratados na Plataforma, nos termos da Lei
            13.709/2018 (Lei Geral de Proteção de Dados — LGPD).
          </p>
          <p><strong>Dados coletados:</strong> nome, e-mail, apelido, senha (armazenada com hash), avatar, biografia,
            CPF, nome de cobrança e data de nascimento (para depósitos), chave PIX (para saques), endereço IP e
            identificação de dispositivo (para prevenção a fraude e suporte técnico), histórico de partidas, mensagens
            de chat e registros de atividade na conta.</p>
          <p><strong>Bases legais e finalidades:</strong> execução de contrato (prestação do serviço de jogo), cumprimento
            de obrigação legal ou regulatória (prevenção a fraude e lavagem de dinheiro em transações financeiras),
            legítimo interesse (segurança, prevenção a cheating, melhoria da Plataforma) e consentimento (comunicações
            de marketing, quando aplicável).</p>
          <p><strong>Compartilhamento:</strong> dados financeiros podem ser compartilhados com a Asaas (processadora de
            pagamentos PIX) exclusivamente para viabilizar depósitos e saques. Dados de partidas podem ser enviados a
            provedores de inteligência artificial para análise anti-fraude, conforme detalhado na seção 6.</p>
          <p><strong>Retenção:</strong> dados financeiros e registros de transações são retidos pelo prazo exigido pela
            legislação fiscal e de prevenção à lavagem de dinheiro, mesmo após a exclusão da conta. Demais dados
            pessoais são retidos enquanto a conta estiver ativa.</p>
          <p><strong>Seus direitos:</strong> você pode, a qualquer momento, solicitar acesso, correção, portabilidade ou
            exclusão dos seus dados pessoais, conforme detalhado na seção 7. Para exercer outros direitos previstos na
            LGPD (confirmação de tratamento, anonimização, revisão de decisões automatizadas), entre em contato pelo
            suporte da Plataforma.</p>
        </Section>

        <Section title="3. Partidas casuais e duelos ranqueados">
          <p><strong>Partidas casuais:</strong> pareamento automático pelo ELO mais próximo disponível na fila, sem
            custo de entrada e sem prêmio em Chess Coins ($CC).</p>
          <p><strong>Duelos:</strong> partidas 1x1 ranqueadas com taxa de entrada em $CC (6, 10 ou 20 $CC, conforme o
            tipo). Modalidades disponíveis: FLASH (3 minutos + 2 segundos de incremento por lance) e GIANT (10 minutos,
            sem incremento). A taxa é debitada da carteira de ambos os jogadores no momento da formação da partida, e o
            prêmio corresponde a 90% do total arrecadado (pool), sendo os 10% restantes retidos pela Plataforma como
            taxa de serviço (rake).</p>
          <p>Duelos podem ser formados por convite direto a um amigo ou por entrada em fila pública filtrada por tipo e
            valor da taxa. Antes da liberação do prêmio, a partida passa por uma análise anti-fraude automatizada (ver
            seção 5), com prazo de até 60 minutos; caso a análise não seja concluída nesse prazo, o prêmio é liberado
            automaticamente ao vencedor.</p>
          <p><strong>Torneios customizados:</strong> criados por usuários mediante taxa de criação e taxa de entrada,
            com 4 a 64 participantes em formato eliminatório simples. Premiação em 3º lugar aplicável a torneios com 8
            ou mais jogadores. Torneios sem novos jogadores por 24h recebem aviso de estagnação e são cancelados
            automaticamente após 48h de inatividade, com estorno das taxas pagas.</p>
          <p><strong>Conduta esperada:</strong> é proibido o uso de motores de xadrez (engines), múltiplas contas para
            burlar o pareamento ou o sistema financeiro, conluio entre jogadores (combinar resultados), abandono
            proposital repetido de partidas e qualquer forma de manipulação de resultado. A violação pode resultar em
            advertência, suspensão temporária ou banimento permanente, além da perda dos valores envolvidos na partida
            irregular.</p>
        </Section>

        <Section title="4. Taxas e regras financeiras">
          <p>A unidade de crédito interna da Plataforma é o Chess Coin ($CC), com paridade fixa de 1 $CC = R$ 1,00.
            $CC não é um ativo financeiro, criptoativo ou meio de pagamento fora da Plataforma, e não pode ser
            transferido diretamente entre usuários fora dos mecanismos de jogo (duelos, torneios e prêmios).</p>
          <p><strong>Depósitos:</strong> realizados via PIX, processados pela Asaas. O crédito em $CC ocorre após a
            confirmação do pagamento via webhook. CPF e data de nascimento são obrigatórios a cada depósito (podendo ser
            reaproveitados do perfil, se já cadastrados) para emissão da cobrança e verificação de maioridade.</p>
          <p><strong>Saques:</strong> sujeitos a um prazo de segurança de 25 minutos, durante o qual é realizada uma
            análise heurística de padrões suspeitos de jogo (ex.: lances consistentemente abaixo de 1,5 segundo) e,
            quando disponível, uma análise complementar por inteligência artificial. Aprovado o saque, o valor é
            transferido via PIX pela Asaas. Incide uma taxa de saque de 2% sobre o valor solicitado, com mínimo de 2
            $CC por operação.</p>
          <p><strong>Débitos de duelos e torneios:</strong> processados com controle transacional (lock pessimista no
            banco de dados) para impedir condições de corrida e débito duplicado.</p>
          <p>A Plataforma pode alterar valores de taxas, limites mínimos/máximos de depósito e saque, e regras de
            elegibilidade financeira mediante atualização destes Termos ou comunicação na Plataforma.</p>
        </Section>

        <Section title="5. Sistema de denúncias (report)">
          <p>Ao final de uma partida online (exceto partidas offline contra a IA), qualquer participante pode denunciar
            o adversário por suspeita de uso de engine, em até 72 horas após o término da partida, com limite de 3
            denúncias por dia por usuário.</p>
          <p>Cada denúncia é analisada automaticamente por um sistema de inteligência artificial, que avalia fatores
            como tempo médio de resposta, taxa de lances considerados "perfeitos" para o rating do jogador e
            consistência dos lances com o nível declarado. O resultado pode ser: sem indícios (CLEAN), suspeito
            (SUSPICIOUS) ou confirmação de uso de engine (CHEATING).</p>
          <p>Vereditos suspeitos ou confirmados, assim como falhas na análise automática, são encaminhados para revisão
            manual pela equipe de moderação, que pode aplicar advertência, suspensão temporária ou banimento
            permanente, conforme a gravidade.</p>
          <p>Caso o veredito seja "sem indícios" (CLEAN), o denunciante pode apelar dentro de 48 horas, solicitando
            revisão manual adicional. Denúncias falsas ou feitas de má-fé estão sujeitas às mesmas penalidades previstas
            para conduta antidesportiva.</p>
        </Section>

        <Section title="6. Uso de inteligência artificial">
          <p>A Plataforma utiliza serviços de inteligência artificial (DeepSeek) para as seguintes finalidades:</p>
          <p>
            <strong>(a) Anti-cheat:</strong> análise de partidas denunciadas, com envio de dados como PGN da partida,
            tempos de lance e rating dos jogadores (sem dados de contato ou financeiros).<br />
            <strong>(b) Análise de risco de saque:</strong> avaliação de padrões de jogo suspeitos antes da liberação de
            saques.<br />
            <strong>(c) Suporte ao usuário:</strong> assistência automatizada em tickets de suporte.<br />
            <strong>(d) Ferramentas administrativas:</strong> geração de relatórios de partida, perfil comportamental e
            sumarização de tickets para a equipe de moderação.
          </p>
          <p>Nenhuma decisão que resulte em banimento permanente ou perda definitiva de valores é tomada
            exclusivamente por IA sem possibilidade de revisão humana. Você pode solicitar revisão humana de qualquer
            decisão automatizada que produza efeitos relevantes sobre sua conta, conforme o art. 20 da LGPD, através dos
            canais de suporte.</p>
        </Section>

        <Section title="7. Uso de dados e exclusão de conta">
          <p>Você pode, a qualquer momento, excluir sua conta através da página de perfil. Caso possua saldo em
            carteira, será alertado de que o saldo será perdido caso opte por prosseguir sem realizar o saque prévio.</p>
          <p>Ao excluir sua conta: seus dados pessoais identificáveis (nome, e-mail, CPF, data de nascimento, chave
            PIX, avatar, biografia) são removidos ou anonimizados; seu e-mail e apelido são liberados, permitindo a
            criação de uma nova conta caso deseje; a conta é marcada como inativa e o acesso à Plataforma é bloqueado
            imediatamente.</p>
          <p>Registros de partidas, avaliações recebidas por outros usuários e transações financeiras são preservados
            de forma anonimizada, pois são necessários para manter a integridade do histórico de outros jogadores e
            para cumprir obrigações legais de guarda de registros financeiros (prevenção à lavagem de dinheiro e
            legislação fiscal). Essa retenção parcial está amparada pelo art. 16 da LGPD (cumprimento de obrigação
            legal ou regulatória pelo controlador).</p>
        </Section>

        <Section title="8. Suspensão e banimento de contas">
          <p>A Plataforma pode suspender temporariamente ou banir permanentemente contas que violem estes Termos,
            incluindo, mas não se limitando a: uso de engines ou ferramentas de auxílio externo, múltiplas contas,
            manipulação de resultados, fraude em depósitos ou saques, comportamento abusivo com outros usuários e
            tentativas de burlar os sistemas de segurança da Plataforma.</p>
          <p>Em caso de suspensão ou banimento, o usuário pode contatar o suporte para esclarecimentos. Valores em
            carteira vinculados a atividade fraudulenta comprovada podem ser retidos ou estornados.</p>
        </Section>

        <Section title="9. Propriedade intelectual">
          <p>Marca, identidade visual, código-fonte, layout e demais elementos da Plataforma são de titularidade da
            Mega Chess Online ou de seus licenciadores, sendo vedada a reprodução, engenharia reversa ou uso comercial
            não autorizado.</p>
        </Section>

        <Section title="10. Limitação de responsabilidade">
          <p>A Plataforma é fornecida "como está". Não garantimos disponibilidade ininterrupta do serviço e não nos
            responsabilizamos por perdas decorrentes de instabilidade de conexão do usuário, uso indevido da conta por
            terceiros com credenciais do próprio usuário, ou eventos fora de nosso controle razoável.</p>
        </Section>

        <Section title="11. Alterações destes termos">
          <p>Estes Termos podem ser atualizados periodicamente. Alterações materiais exigirão novo aceite explícito
            antes de você continuar utilizando a Plataforma. A versão vigente é sempre identificada pela data no topo
            desta página.</p>
        </Section>

        <Section title="12. Legislação aplicável e contato">
          <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Dúvidas, solicitações relacionadas
            a dados pessoais ou reclamações podem ser enviadas para{' '}
            <a href="mailto:suporte@megachess.io" style={{ color: 'var(--color-primary)' }}>suporte@megachess.io</a>.</p>
        </Section>
      </Card>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0 }}
        />
        Li e concordo com os Termos de Uso e a Política de Privacidade descritos acima.
      </label>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="button" variant="ghost" onClick={() => logout()}>
          Sair da conta
        </Button>
        <Button type="button" fullWidth disabled={!checked} loading={loading} onClick={handleAccept}>
          Aceitar e continuar
        </Button>
      </div>
    </div>
  );
}
