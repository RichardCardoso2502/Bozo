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

Registre os comandos no servidor de teste:

```bash
npm run deploy
```

Inicie o bot:

```bash
npm start
```

## Como jogar

1. Uma pessoa cria a partida:

   ```text
   /bozo-criar rodadas:3
   ```

2. Cada jogador usa `/bozo-entrar`.
3. Quem criou a partida usa `/bozo-iniciar`.
4. O bot avisa o jogador da vez. Ele usa `/bozo-confirmar` para rolar cinco dados.
5. Depois da rolagem, o jogador usa `/bozo-marcar` e escolhe uma categoria.
6. O bot soma os pontos, avisa o próximo jogador e repete até o fim das rodadas.

Use `/bozo-status` para consultar a pontuação.

As categorias seguem as regras definidas: Ás, Duque, Terno, Quadra, Quina, Sena, Fu, Seguida, Quadrada e General.

Nesta primeira versão, cada jogador faz uma rolagem por turno, sem separar dados ou relançar. As partidas ficam em memória e são perdidas quando o bot é reiniciado.

`/ping` continua disponível para testar a latência do bot.
