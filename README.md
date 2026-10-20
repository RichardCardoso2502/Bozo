# Bozo Discord Bot

Bot Discord de Bozó em JavaScript usando `discord.js`.

## Requisitos

- Node.js 18 ou mais recente
- Uma aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)

## Configuração

1. Crie um bot no Discord Developer Portal e copie o token.
2. Convide o bot para o servidor com os escopos `bot` e `applications.commands`.
3. Copie `.env.example` para `.env`.
4. Preencha:
   - `DISCORD_TOKEN`: token do bot.
   - `DISCORD_CLIENT_ID`: Application ID da aplicação.
   - `DISCORD_GUILD_ID`: ID do servidor de teste.

Nunca compartilhe o token do bot.

## Executar

Instale as dependências:

```bash
npm install
```

Registre os comandos no Discord:

**Para qualquer servidor (recomendado):** os comandos ficam disponíveis em todos os servidores onde o bot estiver. Pode demorar até 1 hora para aparecer após o registro.

```bash
npm run deploy
```

**Para teste rápido em um servidor específico** (aparecem instantaneamente):

```bash
DISCORD_GUILD_ID=SEU_ID_DO_SERVIDOR node src/deploy-commands.js --guild
```

Inicie o bot:

```bash
npm start
```

## Como jogar

1. Uma pessoa cria a partida:

   ```text
   /bozo-criar rodadas:3 (de 3 a 10 rodadas)
   ```

   Junto com a mensagem de criação aparecem dois botões:
   - **Entrar na Partida**: qualquer jogador pode clicar para entrar.
   - **Iniciar Partida**: somente quem criou a partida pode clicar (alternativa ao `/bozo-iniciar`).

2. Cada jogador usa `/bozo-entrar` (ou clica no botão "Entrar na Partida").
3. Quem criou a partida usa `/bozo-iniciar` ou clica no botão "Iniciar Partida".
4. O bot avisa o jogador da vez. Ele usa `/bozo-confirmar` para rolar cinco dados.
5. Depois da rolagem, o jogador usa `/bozo-marcar` e escolhe uma categoria.
6. O bot soma os pontos, avisa o próximo jogador e repete até o fim das rodadas.

Use `/bozo-status` para consultar a pontuação.

Partidas de **10 (Clássico)** dão prioridade a quem completar as 10 combinações diferentes com pontuação positiva. Se ninguém completar, vence quem somar mais pontos. Se mais de um completar, os pontos decidem entre eles. O status do Clássico mostra também a quantidade de combinações realizadas, por exemplo: `100 pontos (7/10 combinações)`. Partidas de 3 a 9 rodadas continuam sendo decididas apenas pelos pontos.

Se precisar encerrar a partida antes do fim (útil para testes), quem criou a partida usa `/bozo-encerrar`.

As categorias seguem as regras definidas: Ás, Duque, Terno, Quadra, Quina, Sena, Fu, Seguida, Quadrada e General.

Nesta primeira versão, cada jogador faz uma rolagem por turno, sem separar dados ou relançar. As partidas ficam em memória e são perdidas quando o bot é reiniciado.

`/ping` continua disponível para testar a latência do bot.

## Hospedagem gratuita (24 horas)

O bot precisa ficar rodando continuamente. Aqui estão opções gratuitas para hospedá-lo:

### Opção 1: Render (recomendado)

1. Crie uma conta gratuita em [render.com](https://render.com) e conecte seu GitHub.
2. Crie um **Web Service** selecionando este repositório.
3. Defina:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Na seção **Environment Variables**, adicione:
   - `DISCORD_TOKEN`: seu token do bot
   - `DISCORD_CLIENT_ID`: ID da aplicação
   - (opcional) `DISCORD_GUILD_ID`: apenas se quiser testes em um servidor específico
5. Salve e o deploy será feito automaticamente.

> Aviso: na camada gratuita do Render, o serviço pode "hibernar" após inatividade. O bot Discord continua funcionando porque ele mantém conexão ativa com o Discord (gateway), mas a URL da web pode dormir. Isso não afeta o funcionamento do bot em servidores.

### Opção 2: Koyeb

1. Crie conta em [koyeb.com](https://koyeb.com).
2. Crie um **Native Docker** ou **Git deployment** apontando para este repositório.
3. Defina o comando de início: `npm start`.
4. Adicione as variáveis de ambiente `DISCORD_TOKEN` e `DISCORD_CLIENT_ID`.
5. A camada gratuita (Nano instance) roda 24h.

### Opção 3: Railway

1. Crie conta em [railway.app](https://railway.app).
2. Crie um projeto a partir deste repositório GitHub.
3. Adicione as variáveis de ambiente.
4. A Railway oferece um crédito gratuito inicial (suficiente para vários meses em um bot simples).

### Variáveis de ambiente obrigatórias na nuvem

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DISCORD_TOKEN` | Sim | Token do bot no Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Sim | Application ID da aplicação |
| `DISCORD_GUILD_ID` | Não | Apenas para registro rápido de comandos em um servidor de teste |

Lembre-se: **não suba o arquivo `.env` no GitHub**. Use apenas as variáveis de ambiente do painel da hospedagem.
