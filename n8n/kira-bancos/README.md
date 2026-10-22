# Kira — bancos

Ferramenta da Kira (n8n) que lê as contas do **Inter e do Nubank** pelo Open Finance, via
[Meu Pluggy](https://meu.pluggy.ai) (grátis para as próprias contas, até 5 conexões).

- **Só leitura:** o código só faz `GET` na API da Pluggy (o único `POST` é o login). Nada move dinheiro: sem Pix,
  transferência, pagamento, aplicação ou resgate.
- **Só no modo Pessoal:** em outro ambiente a ferramenta não consulta e a Kira pede para trocar ("modo pessoal").
- **Nada guardado:** os dados são lidos na hora; o workflow não salva execuções que deram certo.

## Onde fica no n8n

| Peça | Nome no n8n |
|---|---|
| Sub-workflow da ferramenta | `Kira — bancos (ferramenta)` (só a Kira 2.0 pode chamar) |
| Ferramenta no agente | nó `consultar_bancos` no workflow `Kira 2.0 — Assistente pessoal`, grupo *Cérebro da Kira* |
| Conexões | tabela `kira_bancos` (`item_id`, `banco`, `ativo`) |
| Credencial | `Pluggy (bancos)`, tipo **Custom Auth** |

Os arquivos `.js` desta pasta são o código dos nós Code do sub-workflow (`Preparar consulta`, `Consultar bancos` e
`Explicar falha`), guardados aqui como cópia e histórico. Ao mudar um deles, cole o mesmo código no nó.

## Como está ligado

Ligado em outubro de 2026 com o **Inter** e o **Nubank**. Para refazer ou acrescentar um banco:

1. Em **meu.pluggy.ai**, conecte o banco pelo Open Finance (cada banco pede a autorização no app dele).
2. No **Dashboard da Pluggy**, entre em **Demo > Conectar Conta** e escolha **MeuPluggy** (não o banco direto: a
   conta de desenvolvedor só conecta bancos pelo MeuPluggy). Autorize logo o banco na tela do Meu Pluggy; se a
   página ficar parada, a conexão vem com `USER INPUT TIMEOUT` e precisa ser refeita.
3. Na conexão criada, use os três pontinhos > **Copiar Item ID** (um Item ID por banco).
4. Na tabela **kira_bancos**, crie a linha: `item_id` = o Item ID, `banco` = nome do banco, `ativo` = true.

A credencial **Pluggy (bancos)** (tipo *Custom Auth*) usa o **Client ID** e o **Client Secret** da mesma aplicação
do Dashboard (menu **Aplicações**), no formato:

```json
{"body": {"clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "clientSecret": "..."}}
```

Se a Pluggy responder `clientId must be a UUID`, o Client ID na credencial não é o da aplicação (ou ficou o texto de
exemplo). O trial do Dashboard pode acabar sem afetar a leitura das contas já conectadas, mas há relatos de que
depois dele não dá para conectar bancos novos.

No Telegram: `modo pessoal` e depois, por exemplo, "quanto tenho nos bancos?".

## O que dá para pedir

| tipo | O que traz |
|---|---|
| `resumo` (padrão) | saldo de cada conta, fatura atual de cada cartão (vencimento e limite), total investido, patrimônio líquido e alertas (fatura vencendo em 7 dias, conta negativa, conexão com erro, consentimento vencendo) |
| `transacoes` | extrato do período (padrão: 30 dias), com filtro por texto ou `entradas`/`saídas` |
| `gastos` | gastos por categoria, maiores estabelecimentos, entradas e resultado do período (padrão: mês atual) |
| `faturas` | fatura atual e as 6 últimas fechadas de cada cartão |
| `investimentos` | posições por tipo e total |
| `conexoes` | situação de cada banco e data da última sincronização |

Transferências entre contas próprias, pagamento de fatura e aplicação/resgate não contam como gasto nem entrada
(senão o mesmo dinheiro contaria duas vezes); a resposta mostra esse total à parte em `fora_da_conta`.

Os valores são os da última sincronização do banco com a Pluggy, não em tempo real; toda resposta traz `dados_de`.

### Particularidades vistas nos dados reais

- O saldo "aplicado automaticamente" (`automaticallyInvestedBalance`) já está dentro do saldo da conta: não somar.
- O vencimento do cartão (`balanceDueDate`) é o da última fatura fechada; quando já passou, a ferramenta mostra o
  próximo como `vencimento_previsto` e omite o pagamento mínimo (que é da fatura fechada).
- O pagamento da fatura aparece no cartão como crédito "PAGAMENTO ON LINE" (categoria qualquer) e a aplicação na
  conta como "Débito Renda Fixa - Lig Liquidez" (às vezes com categoria "Groceries"): os dois ficam fora dos gastos.
- Compras no cartão às vezes vêm com categoria de transferência ou investimento: viram "Compras no cartão".

## Teste local

`teste/simular.js` roda os três nós com uma Pluggy simulada (contas, cartão, transações, faturas, investimentos e
erros), sem rede:

```sh
cd n8n/kira-bancos/teste
npm install
npm test
```
