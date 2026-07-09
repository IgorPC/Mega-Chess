# Mega Chess Online — Modelo de Negócio

> **Última atualização:** 2026-07-01

---

## Índice

1. [Moeda Virtual ($CC)](#1-moeda-virtual-cc)
2. [Tabela Geral de Modalidades](#2-tabela-geral-de-modalidades)
3. [Partidas Regulares (Gratuitas)](#3-partidas-regulares-gratuitas)
4. [Duelo 1v1 — Relâmpago e Gigantes](#4-duelo-1v1--relâmpago-e-gigantes)
5. [Torneios Criados por Jogadores](#5-torneios-criados-por-jogadores)
6. [Chaveamento e Fluxo de Partidas](#6-chaveamento-e-fluxo-de-partidas)
7. [Rake e Distribuição de Prêmios](#7-rake-e-distribuição-de-prêmios)
8. [Lista de Torneios e Filtros](#8-lista-de-torneios-e-filtros)
9. [Histórico de Partidas em Torneios](#9-histórico-de-partidas-em-torneios)
10. [Regras de Saque](#10-regras-de-saque)
11. [Sistema de Indicações](#10a-sistema-de-indicações)
12. [Fluxo de Caixa e Compliance](#11-fluxo-de-caixa-e-compliance)
13. [Inconsistências Corrigidas e Melhorias Sugeridas](#12-inconsistências-corrigidas-e-melhorias-sugeridas)

---

## 1. Moeda Virtual ($CC)

**$CC = Chess Coins** — moeda virtual interna da plataforma.

| Conversão | Valor |
|---|---|
| Depósito via PIX | 1 BRL = 1 $CC |
| Saque via PIX | 1 $CC = 1 BRL (menos taxa de saque) |

A plataforma não trabalha com centavos — todos os valores de $CC são inteiros. Qualquer cálculo que resulte em fração é arredondado para baixo, e o restante fica retido como rake adicional.

O Asaas (gateway de pagamento) opera exclusivamente em BRL. Toda lógica de $CC é interna ao banco de dados.

---

## 2. Tabela Geral de Modalidades

| Modalidade | Entrada | Jogadores | Rake | Pote de Prêmios | Tempo por Partida |
|---|---|---|---|---|---|
| Partida Regular | Grátis | 2 | 0% | — | Customizável |
| Duelo Relâmpago (1v1) | 6, 10 ou 20 $CC | 2 | 10% | 90% da arrecadação | Blitz 3+2 |
| Duelo de Gigantes (1v1) | 6, 10 ou 20 $CC | 2 | 10% | 90% da arrecadação | Rápido 10+0 |
| Torneio (criado por jogador) | Definido pelo criador | 4 ou 8 *(ver nota)* | 10% | 90% do total arrecadado | Definido pelo criador |

> **Nota sobre tempo nos torneios:** O criador escolhe a cadência de tempo. Opções disponíveis: Blitz 3+2, Blitz 5+0, Blitz 5+3, Rápido 10+0, Rápido 15+10. O formato indica minutos por jogador por partida.

> **Nota sobre tamanho de torneios (2026-06-28):** O limite atual de jogadores por torneio é **4 ou 8**. Os tamanhos maiores (16, 32, 64) estão planejados mas aguardam validação de experiência com os menores primeiro.

> ⚠️ **Status atual (2026-06-28):** O módulo de **Torneios Criados por Jogadores** está temporariamente desabilitado na plataforma. Apenas os **Duelos 1v1** estão disponíveis. Os torneios serão reativados quando o módulo estiver totalmente validado.

---

## 3. Partidas Regulares (Gratuitas)

- **Objetivo:** Retenção de usuários, treino, estabilização do Rating ELO e prevenção de smurfing nos torneios pagos.
- **Custo:** Gratuito, sem premiação em $CC.
- **Resultado:** O jogador ganha ou perde pontos de ranking (ELO, K=32).
- **Tempo:** Customizável pelo jogador (Blitz 3+2, Rápido 10+0, etc.).
- **Timer atual do sistema:** 60 segundos por lance (server-side). Este timer é exclusivo das partidas regulares — torneios usam relógio por jogador.

---

## 4. Duelo 1v1 — Relâmpago e Gigantes

### Conceito

Microtorneio de Eliminação Direta Automatizado. Partida única — quem vencer leva o prêmio.

### Opções de Entrada

O jogador escolhe o valor antes de entrar na fila ou convidar alguém:

| Opção | Entrada por jogador | Arrecadação Total | Rake (10%) | Prêmio Vencedor |
|---|---|---|---|---|
| Nível 1 | 6 $CC | 12 $CC | 1 $CC | 11 $CC |
| Nível 2 | 10 $CC | 20 $CC | 2 $CC | 18 $CC |
| Nível 3 | 20 $CC | 40 $CC | 4 $CC | 36 $CC |

> **Regra de rake mínimo:** O valor mínimo de entrada é calibrado para que `floor(arrecadação × 0.10) ≥ 1 $CC`. Isso garante que a plataforma sempre retenha pelo menos 1 $CC de rake em qualquer duelo, cobrindo o custo operacional da partida. Entradas de 2 ou 5 $CC por jogador produziriam rake = 0 após arredondamento e foram removidas.

### Diferença entre Relâmpago e Gigantes

| | Duelo Relâmpago | Duelo de Gigantes |
|---|---|---|
| Tempo | Blitz 3+2 (3 min + 2s/lance) | Rápido 10+0 (10 min por jogador) |
| Perfil | Partida explosiva e rápida | Partida de qualidade, mais reflexiva |
| Anti-cheat | Mais eficaz (tempo curto dificulta engine) | Análise de PGN pós-jogo no saque |

### Formas de Entrar no Duelo 1v1

#### Opção A — Matchmaking Aleatório

1. O jogador escolhe a modalidade (Relâmpago ou Gigantes) e o valor da entrada (6, 10 ou 20 $CC).
2. O sistema verifica se o jogador tem saldo suficiente (`assertBalance`) — **nenhum valor é reservado ou bloqueado neste momento**.
3. O jogador entra na fila de matchmaking filtrada por modalidade + valor (`DUEL_FLASH:6`, `DUEL_FLASH:10`, etc.).
4. Ao encontrar um oponente com os mesmos critérios, **os $CC de ambos são debitados imediatamente** antes da partida começar.
5. Se o débito de algum dos jogadores falhar (saldo insuficiente no momento do match), a partida é cancelada e o jogador que já foi debitado recebe reembolso automático.
6. Se o jogador sair da fila antes de ser pareado, nenhum $CC foi movimentado — saída sem custo.

#### Opção B — Convite Direto para Amigo

1. O jogador acessa a lista de amigos online e clica em "Desafiar para Duelo".
2. O jogador seleciona: modalidade (Relâmpago ou Gigantes) e valor da entrada (6, 10 ou 20 $CC).
3. O sistema envia uma notificação ao amigo convidado contendo:
   - Nome e foto do desafiante
   - Rating ELO do desafiante
   - Modalidade selecionada
   - **Valor da entrada: X $CC** (exibido em destaque)
   - Botões: "Aceitar" e "Recusar"
4. O convidado tem **30 segundos** para aceitar. Se não aceitar, o convite expira automaticamente.
5. Ao aceitar, os $CC de ambos são debitados e a partida começa.
6. Ao recusar ou expirar, nenhum $CC é movimentado.

> **Regra de saldo:** O sistema deve verificar o saldo do convidado **no momento do aceite**, não no envio do convite.

### Regra de Empate no 1v1

- O rake de 10% é retido normalmente.
- O pote restante é dividido igualmente entre os dois jogadores.
- Exemplo (Nível 2): 10 $CC coletados → 1 $CC rake → 9 $CC ÷ 2 = **4 $CC para cada jogador** (1 $CC fica como rake adicional por arredondamento).

### Regra de Desempate — Armageddon

Se a partida empatar e o resultado for empate (draw por acordo, afogamento, repetição, etc.):
- O sistema inicia imediatamente uma partida de desempate no formato **Armageddon**:
  - Brancas: 3 minutos — **obrigação de vencer**
  - Pretas: 2 minutos — empate é considerado vitória das Pretas
  - Se empatar novamente: vitória declarada para as **Pretas**
- No Armageddon, não há rake adicional — o prêmio original é entregue ao vencedor.

---

## 5. Torneios Criados por Jogadores

### Conceito

Qualquer jogador com saldo suficiente pode criar um torneio personalizado. O criador define as regras, o custo de entrada e a privacidade. O sistema cuida do chaveamento, das partidas e da distribuição de prêmios automaticamente.

### Criação do Torneio

O jogador preenche um formulário de criação com as seguintes configurações:

| Campo | Tipo | Restrições |
|---|---|---|
| Nome do torneio | Texto | Máximo 60 caracteres |
| Custo de entrada por jogador | Número inteiro | Mínimo 1 $CC |
| Total de jogadores (vagas) | Número | **4 ou 8** (potência de 2; 16, 32 e 64 planejados) |
| Cadência de tempo | Seleção | Blitz 3+2 / Blitz 5+0 / Blitz 5+3 / Rápido 10+0 / Rápido 15+10 |
| Visibilidade | Toggle | Público ou Privado |
| Senha (se privado) | Texto | Obrigatória se privado |

> **Regra do criador:** O criador também paga a taxa de entrada e ocupa uma vaga. Para criar um torneio de 5 $CC, o jogador precisa ter pelo menos 5 $CC disponíveis em saldo. O débito só ocorre quando o torneio iniciar.

> **Prêmios:** O prêmio não é configurável pelo criador — ele é sempre 90% do total arrecadado (número de jogadores × custo de entrada). O criador vê a prévia do prêmio no momento da criação.

### Taxa de Criação de Torneio

Além da taxa de entrada (que só é debitada no início), o criador paga uma **taxa de criação não-reembolsável** no ato de criar o torneio. Esta taxa é debitada imediatamente.

| Custo de entrada do torneio | Taxa de criação |
|---|---|
| 1 a 4 $CC | 2 $CC |
| 5 a 9 $CC | 3 $CC |
| 10 a 19 $CC | 5 $CC |
| 20 $CC ou mais | 10 $CC |

**Finalidade da taxa de criação:**
- Desincentivar a criação de torneios especulativos que nunca vão encher (spam de lobby).
- Cobrir o custo operacional de manter o torneio ativo na lista e processar notificações enquanto aguarda jogadores.
- A taxa **não é reembolsada** em caso de cancelamento do torneio pelo criador ou por cancelamento automático por inatividade — é o custo de ter criado o torneio.

> **Saldo mínimo para criar:** O jogador precisa ter disponível `taxa de criação + custo de entrada` para criar um torneio. Exemplo: torneio de 10 $CC/jogador requer saldo mínimo de 15 $CC (5 CC de taxa + 10 CC de entrada). O sistema verifica e bloqueia a criação se o saldo for insuficiente.

> **Efeito colateral positivo:** A taxa de criação naturalmente filtra torneios com maior comprometimento do criador, resultando numa lista de torneios com maior probabilidade de encher — melhorando a experiência de todos os jogadores.

### Torneios Públicos e Privados

#### Torneio Público
- Qualquer jogador com saldo suficiente pode entrar.
- Aparece na lista pública de torneios com todos os detalhes.

#### Torneio Privado
- Exige senha para entrar, exceto para jogadores convidados diretamente.
- Aparece na lista com cadeado; detalhes básicos (nome, vagas, custo) são visíveis, mas exige senha para entrar.
- O criador pode convidar jogadores de duas formas:
  - **Via lista de amigos:** seleciona amigos diretamente na criação ou após criar o torneio.
  - **Via Nickname:** digita o apelido de qualquer jogador da plataforma para enviar convite.
- Convidados recebem notificação com todos os detalhes do torneio e um botão "Aceitar convite" — não precisam inserir senha.
- Jogadores não convidados que acessarem o torneio privado devem inserir a senha correta.

### Convite para Torneio (Notificação)

A notificação recebida pelo convidado contém:
- Nome do torneio e nome/foto do criador
- Custo de entrada em $CC
- Prêmio estimado (1º, 2º e 3º lugar)
- Total de vagas e vagas restantes
- Cadência de tempo configurada
- Botões: "Aceitar" e "Recusar"
- O convite expira quando o torneio for cancelado ou iniciar.

### Sala de Espera (Lobby do Torneio)

Após entrar no torneio (pré-início), o jogador acessa a **sala de espera** que exibe:
- Lista de todos os participantes inscritos (foto, nickname, ELO)
- Vagas restantes em destaque (ex: "11 / 16 jogadores")
- Regras do torneio (custo, prêmios, tempo, regra de empate)
- Botão "Sair do torneio" (disponível enquanto não iniciado)
- **Para o criador:** botão "Cancelar torneio" e botão "Expulsar" ao lado de cada jogador

> **Aviso de segurança exibido na sala:** "O valor de entrada só será debitado quando o torneio iniciar com todas as vagas preenchidas. Os prêmios serão pagos após análise de IA antifraude da partida."

### Início do Torneio

- O torneio **normalmente inicia** quando **todas as vagas estiverem preenchidas** — o preenchimento total dispara o início automaticamente.
- **Modo Flexível:** o criador pode iniciar manualmente com no mínimo 4 jogadores (mesmo que o torneio tenha capacidade para 8). O bracket é gerado com o número de jogadores presentes no momento do clique.
- No momento do início: os $CC de todos os participantes são debitados simultaneamente.
- O sistema sorteia o chaveamento (bracket) e exibe para todos os participantes.
- A primeira rodada de partidas começa imediatamente após o sorteio do bracket.

### Cancelamento do Torneio

- O criador pode cancelar o torneio **a qualquer momento antes do início**.
- O admin da plataforma pode cancelar ou excluir qualquer torneio que ainda não tenha iniciado.
- **Após o início:** o torneio não pode ser cancelado. Em caso de problemas técnicos, o admin pode encerrar forçadamente — o pote é reembolsado integralmente a todos os participantes.
- Ao cancelar antes do início, nenhum $CC é debitado (nenhuma transação foi feita ainda).

### Cancelamento Automático por Inatividade (Anti-Stagnation)

Para evitar torneios "fantasma" que ficam indefinidamente na lista sem encher, o sistema aplica as seguintes regras automáticas:

| Condição | Ação |
|---|---|
| Torneio criado há mais de 24h sem nenhum novo participante nas últimas 24h | Sistema exibe aviso ao criador: "Seu torneio está sem novos jogadores. Deseja cancelá-lo?" |
| Torneio criado há mais de 48h sem nenhum novo participante nas últimas 24h | Sistema cancela automaticamente e notifica o criador |
| Torneio com vagas ≥ 75% preenchidas (ex: 12/16) há mais de 2h sem novo participante | Sistema envia notificação push para todos os participantes inscritos: "O torneio está quase cheio! Convide um amigo." |

> **Nota para o admin:** O painel admin exibe um indicador de torneios com risco de stagnation (criados há mais de 12h com menos de 50% de vagas preenchidas), permitindo intervenção manual ou boost de visibilidade na lista.

### Torneio Flexível (Bracket Dinâmico)

O criador pode opcionalmente habilitar o **modo Torneio Flexível** ao criar o torneio. Neste modo, o bracket é determinado pelos jogadores reais confirmados no momento do início, não pelo número máximo configurado.

**Regras do Torneio Flexível:**

- O torneio pode iniciar com **no mínimo 50% das vagas configuradas**, arredondado para a potência de 2 inferior.
  - Exemplo: torneio configurado para 16 vagas → inicia com 8+ jogadores, usando bracket de 8.
  - Exemplo: torneio configurado para 32 vagas → inicia com 16+ jogadores, usando bracket de 16.
- O bracket usado é sempre a maior potência de 2 que cabe nos jogadores presentes (ex: 11 jogadores → bracket de 8, 3 ficam de fora por ordem de inscrição).
- **O pote é sempre calculado sobre os jogadores reais que participam do bracket**, não sobre o número máximo configurado.

**Transparência obrigatória — o prêmio é dinâmico:**

Torneios Flexíveis **não exibem valor fixo de prêmio** na lista ou na sala de espera. Em vez disso, exibem:

- "Prêmio estimado: até **144 CC** (com 16 jogadores)" — valor máximo
- "Prêmio atual com jogadores confirmados: **72 CC** (com 8 jogadores)"
- Barra de progresso de vagas com atualização em tempo real
- Aviso em destaque na sala de espera: **"Este é um Torneio Flexível. O prêmio final depende do número de participantes no momento do início."**

Jogadores que entraram num Torneio Flexível podem sair da sala de espera a qualquer momento antes do início sem custo algum, exatamente como em torneios normais.

> **Importante:** O Torneio Flexível resolve o stagnation sem criar promessa de prêmio que não pode ser cumprida. O jogador sempre sabe que o prêmio é proporcional à participação real, e pode decidir sair se o pote atual não compensar. Sem transparência de prêmio dinâmico, o modo seria uma promessa quebrada.

### Expulsão de Jogador (Kick)

- O criador pode expulsar qualquer jogador da sala de espera antes do início.
- Ao ser expulso, o jogador recebe notificação e é redirecionado para a lista de torneios.
- Nenhum $CC é debitado ao jogador expulso.

---

## 6. Chaveamento e Fluxo de Partidas

### Formato: Eliminação Direta (Single Elimination)

Todos os torneios seguem o formato de **eliminação direta com disputa de terceiro lugar**. O número de vagas é sempre potência de 2 (4, 8, 16, 32 ou 64), garantindo um bracket simétrico sem byes.

### Sorteio do Chaveamento

- Ao atingir o número máximo de jogadores, o sistema realiza o sorteio aleatório das posições no bracket.
- O sorteio usa um `seed` derivado do `tournament_id` para auditabilidade e reprodutibilidade.
- O chaveamento completo é exibido instantaneamente para todos os participantes via WebSocket.

### Tela do Torneio (Bracket)

A tela do torneio exibe um **bracket visual interativo** similar ao formato de chaveamento esportivo:

- Cada linha do bracket mostra: foto + nickname + ELO dos dois oponentes.
- Resultado de cada partida (quando disponível): placar com indicação do vencedor em destaque.
- A partida atual do usuário logado é destacada com cor diferente.
- Linhas conectando as fases (oitavas → quartas → semifinal → final → 3º lugar).
- Atualização em tempo real via WebSocket a cada resultado de partida.
- Jogadores eliminados ficam com nome tachado (riscado) no bracket.
- O usuário que perdeu continua na tela do torneio podendo acompanhar o bracket, mas não pode jogar.

### Fluxo de uma Rodada

```
[Bracket exibido com as partidas da rodada atual]
         │
         ▼
[Partida inicia automaticamente entre os dois oponentes]
         │
         ▼
[Partida disputada — resultado definido]
         │
         ▼
[Ambos os jogadores são redirecionados para a tela do torneio]
         │
         ▼
[Bracket se atualiza em tempo real com o resultado]
         │
         ▼
[Aguarda 30 segundos para o próximo adversário ser decidido]
         │
         ▼
[Nova partida inicia automaticamente] ← repete até o fim
```

> **Partidas simultâneas:** Todas as partidas de uma mesma rodada ocorrem simultaneamente. A rodada avança quando todas as partidas da rodada atual tiverem resultado.

### Disputa de Terceiro Lugar

- Os dois perdedores das semifinais disputam o 3º lugar.
- A partida ocorre em paralelo com a grande final.
- Ambos os jogadores recebem notificação e são direcionados para a partida de 3º lugar.

### Regra de Empate e Desempate em Torneios

Em partidas de mata-mata de torneio, empate não é permitido como resultado final. O desempate segue a seguinte ordem:

1. **Contagem de material:** O sistema conta o valor total das peças restantes de cada jogador utilizando a tabela padrão de xadrez:
   - Peão = 1, Cavalo = 3, Bispo = 3, Torre = 5, Dama = 9 (Rei não conta)
   - Quem tiver maior valor de material avança.
2. **Empate de material — desempate por tempo de relógio:** Se ambos os jogadores tiverem exatamente o mesmo valor de material, avança quem tiver **mais tempo restante no relógio** ao fim da partida (campo `clock_ms` do jogador vencedor de tempo). Este critério é objetivo, auditável e não pune nenhuma das partes por um empate inevitável.
3. **Empate total (material e relógio iguais):** Somente se ambos os critérios acima resultarem em empate exato — caso extremamente raro, tipicamente por ambos os relógios marcarem 0 ms simultaneamente — **ambos são eliminados** e a vaga fica vazia no bracket. Esta situação deve ser notificada ao admin imediatamente para registro.
4. Esta regra deve estar claramente exibida nas regras do torneio na sala de espera, incluindo os três critérios em ordem.

> **Importante:** Não existe Armageddon em torneios criados por jogadores. O desempate por relógio como critério secundário torna a dupla eliminação um caso de borda estatisticamente irrelevante, preservando a justiça para os jogadores.

### Distribuição de Prêmios ao Fim do Torneio

Quando o primeiro lugar for decidido:

1. O sistema aguarda a conclusão da disputa de 3º lugar (em paralelo com a final).
2. O backend dispara análise de IA (DeepSeek) sobre as partidas decisivas do campeão e vice-campeão para verificação antifraude.
3. **Após aprovação da IA**, os $CC são transferidos automaticamente às wallets dos vencedores.
4. Todos os participantes recebem notificação com o resultado final do torneio.
5. Se a análise de IA detectar anomalia, o pagamento é retido e encaminhado para revisão manual pelo admin.

### SLA da Análise de IA Antifraude

Para garantir que a retenção de prêmio não seja indefinida por falha ou lentidão da IA, o sistema segue os seguintes SLAs:

| Evento | Prazo | Ação |
|---|---|---|
| Análise de IA concluída sem anomalia | — | Prêmio liberado imediatamente |
| Análise de IA concluída com anomalia | — | Prêmio retido; admin notificado |
| Análise não concluída em **60 minutos** | Timeout | Prêmio liberado automaticamente; caso sinalizado para revisão manual assíncrona |
| DeepSeek retorna erro (5xx / timeout de rede) | Imediato | Sistema faz 2 retentativas com intervalo de 5 min; após a 3ª falha, aplica o timeout de 60 min |

> **Princípio:** O jogador não pode ser punido por falha de infraestrutura da plataforma. O timeout garante que o prêmio seja sempre entregue dentro de 1 hora do fim do torneio, mesmo que a IA esteja indisponível. A revisão manual assíncrona serve como rede de segurança, não como bloqueador.

O jogador vê na tela do torneio (e recebe notificação) o status da análise:
- "Análise antifraude em andamento — prêmio será creditado em até 60 minutos."
- "Prêmio creditado com sucesso."
- "Prêmio retido para revisão — você receberá um e-mail em até 48 horas." (ver seção de Contestação)

---

## 7. Rake e Distribuição de Prêmios

### Taxa Administrativa (Rake)

A plataforma retém **10% do valor total arrecadado** em todos os torneios. Como não há centavos, o rake é arredondado para baixo e a diferença é absorvida pelo pote.

### Cálculo do Prêmio em Torneios

**Fórmula:**
```
Total arrecadado = número de jogadores × custo de entrada
Pote de prêmios  = floor(Total arrecadado × 0.90)
Rake             = Total arrecadado − Pote de prêmios
```

**Distribuição do pote entre os 3 primeiros lugares:**

| Posição | Percentual | Cálculo |
|---|---|---|
| 1º Lugar | 50% | floor(Pote × 0.50) |
| 2º Lugar | 35% | floor(Pote × 0.35) |
| 3º Lugar | 15% | floor(Pote × 0.15) |

> O restante eventual (por arredondamentos) fica retido como rake adicional da plataforma.

### Exemplos de Cálculo

#### Torneio de 16 jogadores × 5 $CC
```
Total arrecadado = 16 × 5 = 80 $CC
Pote de prêmios  = floor(80 × 0.90) = 72 $CC
Rake             = 8 $CC

1º lugar: floor(72 × 0.50) = 36 $CC
2º lugar: floor(72 × 0.35) = 25 $CC
3º lugar: floor(72 × 0.15) = 10 $CC
Total distribuído: 71 $CC (1 $CC adicional fica como rake)
```

#### Torneio de 8 jogadores × 10 $CC
```
Total arrecadado = 8 × 10 = 80 $CC
Pote de prêmios  = floor(80 × 0.90) = 72 $CC
Rake             = 8 $CC

1º lugar: floor(72 × 0.50) = 36 $CC
2º lugar: floor(72 × 0.35) = 25 $CC
3º lugar: floor(72 × 0.15) = 10 $CC
Total distribuído: 71 $CC (1 $CC adicional fica como rake)
```

#### Torneio de 4 jogadores × 3 $CC
```
Total arrecadado = 4 × 3 = 12 $CC
Pote de prêmios  = floor(12 × 0.90) = 10 $CC
Rake             = 2 $CC

1º lugar: floor(10 × 0.50) = 5 $CC
2º lugar: floor(10 × 0.35) = 3 $CC
3º lugar: floor(10 × 0.15) = 1 $CC
Total distribuído: 9 $CC (1 $CC adicional fica como rake)
```

#### Torneio de 64 jogadores × 5 $CC
```
Total arrecadado = 64 × 5 = 320 $CC
Pote de prêmios  = floor(320 × 0.90) = 288 $CC
Rake             = 32 $CC

1º lugar: floor(288 × 0.50) = 144 $CC
2º lugar: floor(288 × 0.35) = 100 $CC
3º lugar: floor(288 × 0.15) = 43 $CC
Total distribuído: 287 $CC (1 $CC adicional fica como rake)
```

### Rake nos Duelos 1v1

| Modalidade | Total Arrecadado | Rake (10%, inteiro) | Prêmio Vencedor |
|---|---|---|---|
| Duelo 1v1 — Nível 1 (6 $CC/jogador) | 12 $CC | 1 $CC | 11 $CC |
| Duelo 1v1 — Nível 2 (10 $CC/jogador) | 20 $CC | 2 $CC | 18 $CC |
| Duelo 1v1 — Nível 3 (20 $CC/jogador) | 40 $CC | 4 $CC | 36 $CC |

### Cancelamento Antes do Início

Se o torneio for cancelado antes de iniciar:
- Nenhum $CC foi debitado (débito só ocorre no início).
- Não há reembolso a processar.

---

## 8. Lista de Torneios e Filtros

### Exibição na Aba de Torneios (`/tournaments`)

A aba de torneios exibe todos os torneios disponíveis na plataforma com atualização em tempo real (via WebSocket ou polling a cada 10 segundos).

### Informações Exibidas por Torneio na Lista

Cada card de torneio na lista exibe:

| Campo | Descrição |
|---|---|
| Nome do torneio | Com ícone de cadeado se privado |
| Criador | Foto + nickname do criador |
| Vagas | "X / Y jogadores" com barra de progresso |
| Custo de entrada | Em $CC |
| Premio total estimado | Total do pote (90% do arrecadado) |
| Prêmio 1º lugar | Em $CC (50% do pote) |
| Prêmio 2º lugar | Em $CC (35% do pote) |
| Prêmio 3º lugar | Em $CC (15% do pote) |
| Cadência de tempo | Ex: "Blitz 5+0" |
| Status | Aguardando jogadores / Em andamento / Finalizado |
| Data de criação | Tempo relativo (ex: "há 5 min") |

### Filtros Disponíveis

| Filtro | Tipo | Opções |
|---|---|---|
| Busca por nome | Input de texto livre | — |
| Visibilidade | Toggle | Todos / Apenas públicos / Apenas privados |
| Status | Seleção | Todos / Aguardando / Em andamento / Finalizados |
| Ordenar por | Seleção | Número de jogadores / Data de criação / Custo em $CC / Prêmio total |
| Direção da ordem | Toggle | Crescente / Decrescente |

### Torneios do Usuário

Uma sub-aba ou seção "Meus Torneios" exibe os torneios em que o usuário está inscrito ou que ele criou, com os mesmos detalhes e filtros acima.

### Atualização em Tempo Real

- A lista recebe eventos WebSocket quando:
  - Um novo torneio é criado
  - Um jogador entra ou sai de um torneio
  - Um torneio é cancelado
  - Um torneio inicia
- Cards de torneios em andamento exibem indicador visual animado (pulso) para chamar atenção.

---

## 9. Histórico de Partidas em Torneios

### Armazenamento de Dados por Partida de Torneio

Todas as partidas disputadas em torneios devem armazenar dados adicionais além do que já existe nas partidas regulares:

```
TournamentMatchRecord
  match_id          → referência para a entidade Match existente
  tournament_id     → referência para o torneio
  tournament_name   → nome do torneio no momento da partida
  entry_fee_cc      → valor pago pelo jogador para entrar
  prize_won_cc      → prêmio recebido ao fim (null se ainda em andamento)
  phase             → fase do torneio (R1, QUARTERFINAL, SEMIFINAL, THIRD_PLACE, FINAL)
  round_number      → número da rodada
  opponent_id       → ID do oponente nesta partida
  move_timestamps   → array JSON com timestamp de cada lance (ms desde início)
  clock_white_ms    → tempo restante das brancas ao fim (ms)
  clock_black_ms    → tempo restante das pretas ao fim (ms)
  time_control      → "3+2" | "5+0" | "5+3" | "10+0" | "15+10"
  tiebreak_result   → null | MATERIAL_WIN | DOUBLE_ELIMINATION
```

### Moves com Timestamp

O campo `move_timestamps` armazena o tempo que o jogador levou para jogar cada lance (em ms):

```json
[
  { "san": "e4", "fen": "...", "elapsed_ms": 3200, "clock_ms": 296800 },
  { "san": "e5", "fen": "...", "elapsed_ms": 5100, "clock_ms": 294900 }
]
```

### Exibição no Histórico de Partidas (`/history`)

#### Listagem

Partidas de torneio devem ser visualmente distintas:

- Badge colorido com o nome do torneio
- Ícone de troféu para partidas onde o jogador foi campeão
- Coluna: **Resultado Financeiro** (+X $CC / -X $CC / 0)
- Indicação da fase (ex: "Final", "Semifinal", "3º Lugar")

#### Tela de Detalhes (ao clicar na partida)

**Seção 1 — Resumo da Partida**
- Foto e nome do oponente, ELO do oponente no momento da partida
- Resultado: Vitória / Derrota / Empate (com motivo: tempo, xeque-mate, desempate por material, dupla eliminação)
- Fase do torneio (ex: "Semifinal — Torneio do Igor #7")
- Controle de tempo: ex: "Blitz 5+0"
- Duração total da partida
- Tempo restante de cada jogador ao fim

**Seção 2 — Financeiro**
- Taxa de inscrição paga: -X $CC
- Prêmio recebido: +Y $CC (ou 0 se perdeu)
- Resultado líquido: ±Z $CC

**Seção 3 — Detalhes do Torneio**
- Nome e criador do torneio
- Data e hora do torneio
- Campeão do torneio
- Posição final do jogador no torneio
- Número total de participantes

**Seção 4 — Replay de Movimentos**
- Tabuleiro interativo com botões Anterior / Próximo / Início / Fim
- Lista de lances em notação SAN (coluna brancas / coluna pretas)
- Tempo usado por lance (exibido ao lado de cada movimento)

---

## 10. Regras de Saque

### Taxa de Saque

- Taxa de **4% do valor sacado**, com mínimo de **3 $CC**.
- Finalidade: cobrir custos de processamento do PIX de saída via Asaas + parcialmente financiar bônus de indicação.
- Saldo mínimo para saque: 10 $CC.

| Saque solicitado | Taxa (4%) | Taxa aplicada | BRL recebido |
|---|---|---|---|
| 10 $CC | 0,40 $CC | 3 $CC (mínimo) | R$ 7,00 |
| 20 $CC | 0,80 $CC | 3 $CC (mínimo) | R$ 17,00 |
| 75 $CC | 3,00 $CC | 3 $CC (mínimo) | R$ 72,00 |
| 100 $CC | 4,00 $CC | 4 $CC | R$ 96,00 |
| 200 $CC | 8,00 $CC | 8 $CC | R$ 192,00 |
| 500 $CC | 20,00 $CC | 20 $CC | R$ 480,00 |

### Processo de Contestação de Saque Bloqueado

Quando um saque é bloqueado pela análise de IA (ou pelo admin), o jogador tem o direito de abrir uma **contestação formal**. O fluxo é:

1. O jogador recebe notificação de bloqueio com o motivo genérico (ex: "Anomalia detectada na análise de partidas") e um código de caso (ex: `#CASE-20260626-001`).
2. O jogador acessa `/wallet → Saques → Contestar` e preenche o formulário de contestação, podendo adicionar texto explicativo livre.
3. O sistema registra a contestação e envia confirmação por e-mail com o código do caso.
4. O admin tem **48 horas úteis** para revisar o caso e tomar uma decisão.

| Decisão | Resultado |
|---|---|
| Contestação aprovada | Saque liberado imediatamente; jogador notificado |
| Contestação negada | Saque permanece bloqueado; e-mail com motivo detalhado e prazo de 5 dias para nova contestação |
| Nova contestação também negada | Caso encerrado; jogador pode acionar canais externos (e-mail de compliance da plataforma) |

> **Compliance:** Este processo garante o direito de defesa do usuário e reduz o risco de chargebacks e reclamações ao Procon/BACEN. Todo o histórico de contestações é armazenado e auditável pelo admin.

> **Prazo máximo:** Se o admin não se manifestar em 48 horas úteis, o sistema libera o saque automaticamente e registra o caso como "aprovado por timeout administrativo".

### Delay Anti-Cheat

Saques de valores ganhos em torneios passam por um **delay automático de 15 a 30 minutos**.

Durante esse período, o backend analisa o **PGN com timestamps** das partidas verificando:

| Critério | Threshold de Alerta |
|---|---|
| Precisão de lances (% de melhores lances) | ≥ 95% |
| Tempo de resposta médio por lance | < 2 segundos consistentes |
| Discrepância entre ELO histórico e qualidade | > 300 pontos de diferença |
| Repetição idêntica de sequências em múltiplas partidas | Detectado por similaridade de PGN |

Se detectada anomalia, o saque é bloqueado e encaminhado para revisão manual.

Saques de $CC adquiridos por depósito (não por torneio) **não** passam pelo delay.

---

### Destinação da Taxa de Saque

De cada taxa de saque arrecadada:
- **50%** (arredondado para baixo, em $CC inteiros) vai para o **indicador** do usuário, se ele tiver sido convidado via link de referência e o indicador ainda possuir indicações elegíveis.
- **Restante** fica retido pela plataforma como receita registrada em `platform_revenue` (tipo `WITHDRAWAL_FEE`).

Exemplo (saque de 100 $CC, taxa = 4 $CC):
- Indicador recebe: floor(4 × 0.50) = **2 $CC** creditados imediatamente na wallet
- Plataforma retém: **2 $CC**

---

## 10A. Sistema de Indicações

### Conceito

Qualquer usuário pode compartilhar um link de convite exclusivo. Quando outro usuário se registra usando esse link e passa a ser elegível, o indicador passa a receber **50% da taxa de saque** a cada vez que o indicado realizar um saque.

### Código de Indicação

- Código único de 8 caracteres (base64url uppercase), ex: `AB3KXZ9T`
- Gerado automaticamente (on-demand, na primeira consulta)
- Link de convite: `https://megachess.io/register?ref=CÓDIGO`
- Disponível na página de perfil do usuário (seção "Indicações")

### Elegibilidade do Indicado

Para que o indicado gere bônus ao indicador, precisa:
1. Ter verificado o e-mail de cadastro
2. Ter realizado **pelo menos 1 depósito** via PIX

### Limite de Indicações Elegíveis

- Cada usuário pode ter no máximo **10 indicações elegíveis** ativas ao mesmo tempo.
- Indicações além de 10 são registradas mas **não geram bônus** (`isEligible = false`).
- Se um indicado inativo se tornar elegível quando o indicador já atingiu o limite, permanece `isEligible = false`.

### Pagamento do Bônus

- O bônus é creditado **no momento da aprovação do saque** do indicado (após o delay anti-cheat).
- Tipo de transação na wallet do indicador: `REFERRAL_BONUS`, com referência ao saque do indicado.
- Registrado também em `referral_earnings` para auditoria.

### Visibilidade

- **Usuário:** seção "Indicações" na página de perfil (visível apenas para o próprio usuário); exibe lista de indicados, elegibilidade e total ganho.
- **Admin:** tela de Indicações em `apps/admin/` + card "Bônus de Indicação" na Visão Financeira de Transações (filtro de período).

---

## 11. Fluxo de Caixa e Compliance

Para que o gateway de pagamento (Asaas) não bloqueie a conta, toda movimentação financeira deve estar atrelada a eventos rastreáveis no banco de dados.

```
[Usuário faz PIX de R$ 80]
       │
       ▼
[Sistema credita 80 $CC na wallet — tipo: DEPOSIT]
       │
       ▼
[Usuário cria torneio de 16 jogadores × 5 $CC]
       │  (nenhum débito ainda — torneio aguardando jogadores)
       ▼
[16 jogadores entram na sala de espera]
       │
       ▼
[Torneio inicia: débito simultâneo de todos os participantes]
   → 16 × débito: -5 $CC — tipo: TOURNAMENT_ENTRY — ref: torneio#ID
       │
       ▼
[Torneio disputado — IA analisa partidas decisivas]
       │
       ▼
[Prêmios distribuídos após aprovação da IA]
   → 1º lugar recebe 36 $CC → tipo: PRIZE — ref: torneio#ID — posição: 1
   → 2º lugar recebe 25 $CC → tipo: PRIZE — ref: torneio#ID — posição: 2
   → 3º lugar recebe 10 $CC → tipo: PRIZE — ref: torneio#ID — posição: 3
   → Plataforma retém 9 $CC  → tipo: RAKE (registrado internamente)
       │
       ▼
[Vencedor solicita saque de 30 $CC]
       │
       ▼
[Débito: -30 $CC — tipo: WITHDRAWAL]
[Débito: -2 $CC  — tipo: WITHDRAWAL_FEE]
       │
       ▼
[Delay 15-30 min + análise anti-cheat]
       │
       ▼
[PIX de R$ 28,00 enviado via Asaas]
```

---

## 12. Inconsistências Corrigidas e Melhorias Sugeridas

### Mudanças da Versão 2026-07-01

| Item | Antes | Depois | Razão |
|---|---|---|---|
| Taxa de saque | 2% / mínimo 2 $CC | **4% / mínimo 3 $CC** | Margem para financiar bônus de indicação sem reduzir receita líquida da plataforma |
| Sistema de Indicações | Não existia | 50% da taxa de saque → indicador (máx 10 elegíveis, requer email verificado + 1 depósito) | Aquisição orgânica de usuários com custo unitário controlado |
| Feature toggles | Configurações do admin ignoradas (bug de chave camelCase vs snake_case) | `deposits_enabled`, `withdrawals_enabled`, `referrals_enabled` funcionando corretamente | Correção crítica de bug; admin agora controla o produto |
| Painel admin — card de Bônus | Dashboard | Transações > Visão Financeira (com filtro de período) | Contexto adequado; dado financeiro pertence à visão financeira |

### Mudanças da Versão 2026-06-28

| Item | Antes | Depois | Razão |
|---|---|---|---|
| Reserva de saldo na fila de duelo | $CC bloqueados ao entrar na fila | Apenas verificação de saldo (`assertBalance`); débito só no match | Simplifica rollback; saldo nunca fica preso por inatividade na fila |
| Fila de duelos | `POST /tournaments/duel/queue` | `POST /matchmaking/duel/queue` | Separação de responsabilidades; matchmaking é domínio próprio |
| Valores de entrada aceitos | 2, 5, 10 $CC | **6, 10, 20 $CC** por jogador | Garante rake mínimo de 1 $CC em todos os duelos |
| Tamanho máximo de torneio | 4, 8, 16, 32 ou 64 | **4 ou 8** (maiores planejados) | Foco em validar experiência antes de escalar |
| Início de torneio | Apenas automático ao encher | Automático ao encher **ou manual pelo criador** (modo flexível, mínimo 4 jogadores) | Evita stagnation; criador tem controle do timing |
| Status do módulo de torneios | Disponível | **Temporariamente desabilitado** (apenas duelos ativos) | Módulo precisa de mais validação antes de produção |

### Mudanças da Versão 2026-06-26 — Revisão Crítica

| Item | Versão Anterior | Versão Atual | Razão |
|---|---|---|---|
| Tipos de torneio | Fixos: Faísca (12p), Tempestade (30p), Grande (64p) | Torneios criados por jogadores: 4, 8, 16, 32 ou 64 jogadores | Flexibilidade e engajamento da comunidade |
| Quem cria torneios | Apenas a plataforma (eventos agendados) | Qualquer jogador com CC suficiente | Demanda de produto |
| Custo de entrada | Fixo em 5 $CC para todos os torneios | Definido pelo criador (mínimo 1 $CC) | Flexibilidade |
| Momento do débito | Na inscrição | Quando o torneio inicia (todas as vagas preenchidas) | Evitar bloqueio de saldo sem garantia de jogo |
| Número de jogadores | Não era potência de 2 (12, 30) | Apenas potências de 2 (4, 8, 16, 32, 64) | Bracket simétrico sem byes ou Swiss |
| Formato do torneio | Grupos + Eliminação (Faísca), Swiss (Tempestade), Mata-mata (Grande) | Eliminação direta (todos) com disputa de 3º | Simplicidade, UX de bracket intuitivo |
| Regra de empate em torneio | Armageddon | Contagem de material; empate total = dupla eliminação | Sem desempate extra; resultado claro e rápido |
| Privacidade de torneio | Não existia | Público ou privado com senha e convites | Demanda de produto |
| Pagamento de prêmios | Imediato após fim | Após análise de IA (DeepSeek) antifraude | Segurança |
| Rake no Nível 1 (1v1 2 $CC) | 0,4 $CC (decimal) | Removido — entrada mínima ajustada para 6 $CC | Rake mínimo de 1 $CC garantido em todos os duelos |
| Valores de entrada do Duelo 1v1 | 2, 5, 10 $CC | 6, 10, 20 $CC por jogador | Elimina rake zero; calibra rake mínimo ≥ 1 $CC |
| Regra de empate total em torneio | Dupla eliminação direta | Desempate por tempo de relógio; dupla eliminação apenas se relógio também empatar | Evita dupla eliminação injusta por posição de empate inevitável |
| Torneios sem preenchimento total | Ficavam indefinidamente na lista | Timeout automático em 24/48h + notificações + modo Torneio Flexível (bracket dinâmico com prêmio transparente) | Evita stagnation sem criar promessa de prêmio que não pode ser cumprida |
| Taxa de criação de torneio | Não existia | Taxa não-reembolsável de 2 a 10 $CC conforme custo de entrada | Desincentivar spam de lobby; cobrir custo operacional de torneios que não iniciam |
| SLA da análise de IA pós-torneio | Indefinido | Timeout de 60 min com liberação automática e revisão assíncrona | Impede retenção indefinida de prêmio por falha de infraestrutura |
| Contestação de saque bloqueado | Não existia | Processo formal de contestação com prazo de 48h e timeout administrativo | Compliance com BACEN/Procon; elimina risco de chargebacks |

### Melhorias Sugeridas

#### 1. Saldo Mínimo para Inscrição
Implementar verificação de saldo + aviso visual ao tentar entrar em torneio sem saldo suficiente. O usuário deve ser direcionado para a carteira para depositar.

#### 2. Notificação de Torneio Quase Cheio
Quando um torneio atingir 80% das vagas, enviar notificação push para jogadores que já visualizaram o torneio mas não se inscreveram.

#### 3. Timeout de Sala de Espera
Se o criador ficar inativo por mais de 24 horas sem o torneio encher, exibir prompt perguntando se deseja cancelar o torneio. Após 48 horas sem nenhum novo participante e vagas restantes, cancelar automaticamente.

#### 4. Histórico Financeiro Dedicado
Além do histórico de partidas, a página `/wallet` exibe extrato completo de transações (depósitos, saques, inscrições, prêmios, rakes) separado do histórico de partidas.

#### 5. Proteção contra Inscrição Dupla
Constraint única no banco: `UNIQUE(tournament_id, user_id)`. Um jogador não pode entrar no mesmo torneio duas vezes.

#### 6. Chave PIX no Cadastro
Solicitar a chave PIX durante o cadastro (ou na primeira vez que o usuário acessa a carteira), não apenas no momento do saque. Reduz atrito no funil de saque.

#### 7. Seed de Sorteio Auditável
O sorteio do bracket usa `seed = tournament_id` para garantir reproducibilidade. Exibir o seed publicamente na tela do torneio para que os jogadores possam verificar a aleatoriedade.

#### 8. Bracket Responsivo para Mobile
O chaveamento deve ter uma versão simplificada para telas menores, com scroll horizontal e destaque automático na partida do usuário logado.
