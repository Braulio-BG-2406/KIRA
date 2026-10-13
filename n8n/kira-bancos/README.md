# Kira — bancos

Ferramenta da Kira (n8n) que lê as contas do **Inter, Bradesco, Banco do Brasil e Nubank** pelo Open Finance, via
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

## Como ligar (uma vez)

1. Em **meu.pluggy.ai**, crie a conta e conecte os 4 bancos pelo Open Finance (cada banco pede a autorização no
   app dele).
2. No **Dashboard da Pluggy**, abra a aplicação e copie o **Client ID** e o **Client Secret**.
3. No n8n, abra o workflow `Kira — bancos (ferramenta)`, clique no nó **Entrar na Pluggy** e crie a credencial
   **Pluggy (bancos)** (tipo *Custom Auth*) com:
   ```json
   {"body": {"clientId": "COLE_AQUI", "clientSecret": "COLE_AQUI"}}
   ```
   Salve o workflow e publique de novo.
4. Ainda no Dashboard: **Demo > Conectar conta > MeuPluggy**, entre com a conta do Meu Pluggy e escolha um banco.
   No menu de três pontos da conexão, **Copiar Item ID**. Repita para cada banco (um Item ID por banco).
5. Na tabela **kira_bancos**, crie uma linha por banco: `item_id` = o Item ID, `banco` = Inter, Bradesco,
   Banco do Brasil ou Nubank, `ativo` = true.
6. No Telegram: `modo pessoal` e depois, por exemplo, "quanto tenho nos bancos?".

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

## Teste local

`teste/simular.js` roda os três nós com uma Pluggy simulada (contas, cartão, transações, faturas, investimentos e
erros), sem rede:

```sh
cd n8n/kira-bancos/teste
npm install
npm test
```
