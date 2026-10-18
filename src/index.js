require('dotenv').config();

const { Client, Events, GatewayIntentBits } = require('discord.js');
const {
  CATEGORY_NAMES,
  addPlayer,
  createGame,
  formatScores,
  getCurrentPlayer,
  rollForCurrentPlayer,
  scoreCurrentPlayer,
  startGame
} = require('./game');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('DISCORD_TOKEN não foi definido. Copie .env.example para .env e preencha o token.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const games = new Map();

function getGame(interaction) {
  return games.get(interaction.guildId);
}

function requireGuild(interaction) {
  return interaction.inGuild() ? null : 'Este comando só pode ser usado dentro de um servidor.';
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Bot conectado como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply(`Pong! Latência: ${client.ws.ping}ms`);
    return;
  }

  if (interaction.commandName === 'regras') {
    const embed = {
      color: 0x5865F2,
      title: '📜 Regras do Bozó',
      description:
        'Bozó é um jogo de dados estratégico que mescla sorte com raciocínio lógico. '
        + 'Popular nos estados de Mato Grosso e Mato Grosso do Sul, o objetivo é alcançar a maior pontuação. '
        + 'Vence quem somar mais pontos ao final das rodadas.',
      fields: [
        {
          name: '🎲 Componentes',
          value: '5 dados D6, 1 copo de couro, tabela e caneta.',
          inline: true
        },
        {
          name: '👥 Jogadores',
          value: 'De 2 a 6 pessoas, jogando no sentido horário.',
          inline: true
        },
        {
          name: '🎯 Como jogar',
          value:
            'Cada jogador lança os 5 dados no copo e verifica se nenhum ficou em cima do outro. '
            + 'Caso contrário, lança novamente. Existem 10 combinações possíveis para pontuar.',
          inline: false
        },
        {
          name: '📊 Pontuação',
          value:
            '• **Ás:** soma dos 1s (1 a 5)\n'
            + '• **Duque:** soma dos 2s (2 a 10)\n'
            + '• **Terno:** soma dos 3s (3 a 15)\n'
            + '• **Quadra:** soma dos 4s (4 a 20)\n'
            + '• **Quina:** soma dos 5s (5 a 25)\n'
            + '• **Sena:** soma dos 6s (6 a 30)\n'
            + '• **Fu:** 2 de um tipo + 3 de outro = 20\n'
            + '• **Seguida:** sequência 1-5 ou 2-6 = 30\n'
            + '• **Quadrada:** 4 iguais + 1 diferente = 40\n'
            + '• **General:** todos iguais = 50',
          inline: false
        }
      ],
      footer: {
        text: 'Use /bozo-criar para iniciar uma partida e /bozo-status para acompanhar o placar.'
      }
    };

    await interaction.reply({ embeds: [embed] });
    return;
  }

  const guildError = requireGuild(interaction);
  if (guildError) {
    await interaction.reply({ content: guildError, ephemeral: true });
    return;
  }

  if (interaction.commandName === 'bozo-criar') {
    const rounds = interaction.options.getInteger('rodadas');
    const existing = games.get(interaction.guildId);
    if (existing && !existing.finished) {
      await interaction.reply({ content: 'Já existe uma partida em andamento neste servidor.', ephemeral: true });
      return;
    }

    games.set(interaction.guildId, createGame(interaction.user.id, rounds));
    await interaction.reply(`Partida criada para **${rounds} rodada(s)**. Use **/bozo-entrar** para participar.`);
    return;
  }

  const game = getGame(interaction);
  if (!game) {
    await interaction.reply({ content: 'Não existe uma partida neste servidor. Use `/bozo-criar`.', ephemeral: true });
    return;
  }

  if (interaction.commandName === 'bozo-entrar') {
    const result = addPlayer(game, interaction.user);
    await interaction.reply({
      content: result.error || `**${result.player.name}** entrou na partida. Jogadores: ${game.players.length}`,
      ephemeral: Boolean(result.error)
    });
    return;
  }

  if (interaction.commandName === 'bozo-iniciar') {
    if (interaction.user.id !== game.ownerId) {
      await interaction.reply({ content: 'Somente quem criou a partida pode iniciá-la.', ephemeral: true });
      return;
    }

    const result = startGame(game);
    if (result.error) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    await interaction.reply(`Partida iniciada! Rodada **1/${game.rounds}**. É a vez de <@${result.player.id}>. Use **/bozo-confirmar** para rolar.`);
    return;
  }

  if (interaction.commandName === 'bozo-confirmar') {
    if (getCurrentPlayer(game)?.id !== interaction.user.id) {
      await interaction.reply({ content: `Agora é a vez de <@${getCurrentPlayer(game)?.id}>.`, ephemeral: true });
      return;
    }

    const result = rollForCurrentPlayer(game);
    if (result.error) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    const dice = result.dice.map(value => `**${value}**`).join(' - ');
    await interaction.reply(`🎲 <@${result.player.id}> rolou: ${dice}\nPontuações disponíveis: ${formatScores(result.scores)}\nEscolha uma categoria com **/bozo-marcar**.`);
    return;
  }

  if (interaction.commandName === 'bozo-marcar') {
    if (getCurrentPlayer(game)?.id !== interaction.user.id) {
      await interaction.reply({ content: `Agora é a vez de <@${getCurrentPlayer(game)?.id}>.`, ephemeral: true });
      return;
    }

    const category = interaction.options.getString('categoria');
    const result = scoreCurrentPlayer(game, category);
    if (result.error) {
      await interaction.reply({ content: result.error, ephemeral: true });
      return;
    }

    if (result.finished) {
      const ranking = [...game.players].sort((a, b) => b.total - a.total)
        .map((player, index) => `${index + 1}. ${player.name}: ${player.total} pontos`)
        .join('\n');
      await interaction.reply(`**${result.player.name}** marcou **${result.points}** pontos.\n\n🏆 Partida encerrada!\n${ranking}`);
      return;
    }

    await interaction.reply(`**${result.player.name}** marcou **${result.points}** pontos em **${CATEGORY_NAMES[category]}**. Rodada **${game.currentRound}/${game.rounds}**. É a vez de <@${result.nextPlayer.id}>. Use **/bozo-confirmar**.`);
    return;
  }

  if (interaction.commandName === 'bozo-status') {
    const players = game.players.map(player => `${player.name}: ${player.total} pontos`).join('\n') || 'nenhum jogador';
    const current = game.started && !game.finished ? `\nVez atual: <@${getCurrentPlayer(game).id}>` : '';
    await interaction.reply(`Partida: ${game.finished ? 'encerrada' : game.started ? `rodada ${game.currentRound}/${game.rounds}` : 'aguardando jogadores'}\n${players}${current}`);
  }
});

client.login(token);
