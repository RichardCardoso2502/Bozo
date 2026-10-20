require('dotenv').config();

const {
  Client,
  Events,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const {
  CATEGORY_NAMES,
  addPlayer,
  createGame,
  getCurrentPlayer,
  rollForCurrentPlayer,
  scoreCurrentPlayer,
  startGame,
  endGame,
  formatPlayerScore
} = require('./game');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('DISCORD_TOKEN não foi definido. Copie .env.example para .env e preencha o token.');
  process.exit(1);
}

// Servidor web simples para satisfazer health check do Railway/Render
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot do Bozó está online!'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor web na porta ${port}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const games = new Map();
const WAITING_GAME_TIMEOUT_MS = 30 * 60 * 1000;

function getGame(guildId) {
  const game = games.get(guildId);
  if (game && !game.started && Date.now() - game.createdAt >= WAITING_GAME_TIMEOUT_MS) {
    games.delete(guildId);
    return undefined;
  }
  return game;
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Bot conectado como ${readyClient.user.tag}`);
});

client.on(Events.Error, error => {
  console.error('Erro no cliente Discord:', { code: error.code, message: error.message });
});

function replyToInteraction(interaction, options) {
  if (interaction.deferred && interaction.isMessageComponent()) {
    if (interaction.ephemeral) return interaction.editReply(options);
    return interaction.followUp(options);
  }
  return interaction.reply(options);
}

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleChatInput(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'bozo_join') {
        await interaction.deferUpdate();
        await handleJoinButton(interaction);
        return;
      }
      if (interaction.customId === 'bozo_start') {
        await interaction.deferUpdate();
        await handleStartButton(interaction);
        return;
      }
      if (interaction.customId === 'bozo_roll') {
        await interaction.deferReply({ ephemeral: true });
        await handleRollButton(interaction);
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'bozo_score') {
        await interaction.deferUpdate();
        await handleScoreSelect(interaction);
      }
    }
  } catch (error) {
    const details = {
      code: error.code,
      message: error.message,
      commandName: interaction.commandName,
      customId: interaction.customId
    };
    if (error.code === 10062) {
      console.warn('Interação expirou antes de ser confirmada:', details);
      return;
    }
    console.error('Erro ao processar interação:', details);

    if (!interaction.isRepliable()) return;

    try {
      const response = { content: 'Ocorreu um erro ao processar esta ação.', ephemeral: true };
      if (interaction.deferred && !interaction.isMessageComponent()) {
        await interaction.editReply({ content: response.content });
      } else if (interaction.replied) {
        await interaction.followUp(response);
      } else if (interaction.deferred) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    } catch (replyError) {
      console.error('Erro ao responder à interação:', { code: replyError.code, message: replyError.message });
    }
  }
});

async function handleChatInput(interaction) {
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
        + 'Nas partidas de 3 a 9 rodadas, vence quem somar mais pontos ao final das rodadas.',
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
          name: 'Modo Clássico (10 rodadas)',
          value:
            'Ao final das 10 rodadas, quem completar as 10 combinações diferentes com pontuação positiva tem prioridade na vitória. '
            + 'Se ninguém completar, vence quem somar mais pontos. Se mais de um completar, os pontos decidem entre eles. '
            + 'Somente no Clássico, o status mostra também a quantidade de combinações realizadas ao lado dos pontos.',
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
    await interaction.deferReply({ ephemeral: true });
    const rounds = interaction.options.getInteger('rodadas');
    const existing = getGame(interaction.guildId);
    if (existing && !existing.finished) {
      await interaction.editReply({ content: 'Já existe uma partida em andamento neste servidor.' });
      return;
    }

    const newGame = createGame(interaction.user.id, rounds);
    addPlayer(newGame, interaction.user);
    newGame.channelId = interaction.channelId;
    games.set(interaction.guildId, newGame);

    const embed = {
      color: 0x5865F2,
      title: '🎲 Partida de Bozó criada!',
      description: `Partida para **${rounds} rodada(s)${rounds === 10 ? ' (Clássico)' : ''}**.\nClique no botão abaixo para entrar.\n\n**Jogadores:**\n• <@${interaction.user.id}>`,
      footer: { text: 'Use /bozo-iniciar quando todos estiverem prontos.' }
    };

    const row = newActionRowCreate();
    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    newGame.messageId = msg.id;
    await interaction.editReply({ content: 'Partida criada e anunciada neste canal.' });
    return;
  }

  const game = getGame(interaction.guildId);

  if (interaction.commandName === 'bozo-entrar') {
    if (!game) {
      await interaction.reply({ content: 'Não existe uma partida neste servidor. Use `/bozo-criar`.', ephemeral: true });
      return;
    }
    const result = addPlayer(game, interaction.user);
    await interaction.reply({
      content: result.error || `**${result.player.name}** entrou na partida. Jogadores: ${game.players.length}`,
      ephemeral: Boolean(result.error)
    });
    return;
  }

  if (!game) {
    await interaction.reply({ content: 'Não existe uma partida neste servidor. Use `/bozo-criar`.', ephemeral: true });
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

    await interaction.deferReply();
    const current = getCurrentPlayer(game);
    const embed = {
      color: 0xFEE75C,
      title: '🎲 Partida iniciada!',
      description: `Rodada **1/${game.rounds}**.\nÉ a vez de <@${current.id}>.\nClique no botão abaixo para rolar os dados.`
    };

    const row = newActionRowRoll();
    const msg = await interaction.editReply({ content: `<@${current.id}>`, embeds: [embed], components: [row] });
    game.rollMessageId = msg.id;
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

    await showScoreSelection(interaction, game, result.player, result.dice, result.scores);
    return;
  }

  if (interaction.commandName === 'bozo-marcar') {
    if (getCurrentPlayer(game)?.id !== interaction.user.id) {
      await interaction.reply({ content: `Agora é a vez de <@${getCurrentPlayer(game)?.id}>.`, ephemeral: true });
      return;
    }

    const category = interaction.options.getString('categoria');
    await handleScoreSelection(interaction, game, category);
    return;
  }

  if (interaction.commandName === 'bozo-status') {
    await interaction.reply(formatGameStatus(game));
  }

  if (interaction.commandName === 'bozo-encerrar') {
    if (!game) {
      await interaction.reply({ content: 'Não existe uma partida neste servidor.', ephemeral: true });
      return;
    }
    if (interaction.user.id !== game.ownerId) {
      await interaction.reply({ content: 'Somente quem criou a partida pode encerrá-la.', ephemeral: true });
      return;
    }

    const { ranking } = endGame(game);

    const embed = {
      color: 0xFF4500,
      title: '🛑 Partida encerrada!',
      description: `A partida foi encerrada pelo criador.\n\n**Placar final:**\n${ranking}`
    };
    await interaction.reply({ embeds: [embed] });
    return;
  }
}

function requireGuild(interaction) {
  return interaction.inGuild() ? null : 'Este comando só pode ser usado dentro de um servidor.';
}

async function handleJoinButton(interaction) {
  const game = getGame(interaction.guildId);
  if (!game || game.messageId !== interaction.message.id) {
    await replyToInteraction(interaction, { content: 'Esta partida não existe mais ou expirou. Use `/bozo-criar` para criar outra.', ephemeral: true });
    return;
  }
  if (game.started) {
    await replyToInteraction(interaction, { content: 'A partida já começou.', ephemeral: true });
    return;
  }
  if (game.players.length >= 6) {
    await replyToInteraction(interaction, { content: 'O jogo permite no máximo 6 jogadores.', ephemeral: true });
    return;
  }
  if (game.players.some(p => p.id === interaction.user.id)) {
    await replyToInteraction(interaction, { content: 'Você já está nesta partida.', ephemeral: true });
    return;
  }

  addPlayer(game, interaction.user);

  const playersList = game.players.map(p => `• <@${p.id}>`).join('\n');
  const embed = {
    color: 0x5865F2,
    title: '🎲 Partida de Bozó criada!',
    description: `Partida para **${game.rounds} rodada(s)${game.rounds === 10 ? ' (Clássico)' : ''}**.\nClique no botão abaixo para entrar.\n\n**Jogadores:**\n${playersList}`,
    footer: { text: 'Use /bozo-iniciar quando todos estiverem prontos.' }
  };

  const row = newActionRowCreate();
  await replyToInteraction(interaction, {
    content: `**${interaction.user.globalName || interaction.user.username}** entrou na partida. Jogadores: ${game.players.length}`,
    ephemeral: true
  });

  try {
    if (game.channelId && game.messageId) {
      const channel = await client.channels.fetch(game.channelId);
      const msg = await channel.messages.fetch(game.messageId);
      await msg.edit({ embeds: [embed], components: [row] });
    }
  } catch (e) {
    console.error('Erro ao atualizar mensagem de entrada:', e);
  }
}

async function handleStartButton(interaction) {
  const game = getGame(interaction.guildId);
  if (!game || game.messageId !== interaction.message.id) {
    await replyToInteraction(interaction, { content: 'Esta partida não existe mais ou expirou. Use `/bozo-criar` para criar outra.', ephemeral: true });
    return;
  }
  if (game.started) {
    await replyToInteraction(interaction, { content: 'A partida já começou.', ephemeral: true });
    return;
  }
  if (interaction.user.id !== game.ownerId) {
    await replyToInteraction(interaction, { content: 'Somente quem criou a partida pode iniciá-la.', ephemeral: true });
    return;
  }

  const result = startGame(game);
  if (result.error) {
    await replyToInteraction(interaction, { content: result.error, ephemeral: true });
    return;
  }

  const current = getCurrentPlayer(game);
  const embed = {
    color: 0xFEE75C,
    title: '🎲 Partida iniciada!',
    description: `Rodada **1/${game.rounds}**.\nÉ a vez de <@${current.id}>.\nClique no botão abaixo para rolar os dados.`
  };

  const row = newActionRowRoll();
  const msg = await replyToInteraction(interaction, { content: `<@${current.id}>`, embeds: [embed], components: [row] });
  game.rollMessageId = msg.id;

  // Atualiza a mensagem original da partida (remove os botões de entrar/iniciar)
  try {
    if (game.channelId && game.messageId) {
      const channel = await client.channels.fetch(game.channelId);
      const msg = await channel.messages.fetch(game.messageId);
      await msg.edit({
        content: '🎲 Partida de Bozó iniciada!',
        embeds: [embed],
        components: []
      });
    }
  } catch (e) {
    console.error('Erro ao atualizar mensagem de criação:', e);
  }
}

async function handleRollButton(interaction) {
  const game = getGame(interaction.guildId);
  if (!game || !game.started || game.finished || game.rollMessageId !== interaction.message.id) {
    await replyToInteraction(interaction, { content: 'Não há uma partida em andamento.', ephemeral: true });
    return;
  }
  if (getCurrentPlayer(game)?.id !== interaction.user.id) {
    await replyToInteraction(interaction, { content: `Agora é a vez de <@${getCurrentPlayer(game)?.id}>.`, ephemeral: true });
    return;
  }

  const result = rollForCurrentPlayer(game);
  if (result.error) {
    await replyToInteraction(interaction, { content: result.error, ephemeral: true });
    return;
  }

  await showScoreSelection(interaction, game, result.player, result.dice, result.scores);

  try {
    if (game.channelId && game.rollMessageId) {
      const channel = await client.channels.fetch(game.channelId);
      const msg = await channel.messages.fetch(game.rollMessageId);
      const disabledRow = newActionRowRoll(true);
      await msg.edit({ components: [disabledRow] });
    }
  } catch (e) {
    console.error('Erro ao desabilitar botão de rolar:', e);
  }
}

async function showScoreSelection(interaction, game, player, dice, scores) {
  const options = Object.entries(scores)
    .filter(([, pts]) => pts > 0)
    .filter(([cat]) => !Object.hasOwn(player.scores, cat))
    .map(([cat, pts]) => ({
      label: `${CATEGORY_NAMES[cat]} (${pts} pts)`,
      value: cat,
      description: `Pontuação: ${pts}`
    }));

  if (options.length === 0) {
    player.dice = null;
    player.availableScores = null;
    await replyToInteraction(interaction, { content: 'Nenhuma combinação pontuável disponível nesta rolagem.', ephemeral: true });
    await advanceTurn(interaction, game, true);
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('bozo_score')
    .setPlaceholder('Escolha uma categoria para marcar')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);

  const embed = {
    color: 0x5865F2,
    title: '🎲 Resultado da rolagem',
    description: `<@${player.id}> rolou: ${dice.map(v => `**${v}**`).join(' - ')}\n\nEscolha abaixo a categoria para marcar:`
  };

  await replyToInteraction(interaction, { content: `<@${player.id}>`, embeds: [embed], components: [row] });
}

async function handleScoreSelect(interaction) {
  const game = getGame(interaction.guildId);
  if (!game || !game.started || game.finished) {
    await replyToInteraction(interaction, { content: 'Não há partida em andamento.', ephemeral: true });
    return;
  }
  if (getCurrentPlayer(game)?.id !== interaction.user.id) {
    await replyToInteraction(interaction, { content: `Agora é a vez de <@${getCurrentPlayer(game)?.id}>.`, ephemeral: true });
    return;
  }

  const category = interaction.values[0];
  const result = scoreCurrentPlayer(game, category);
  if (result.error) {
    await replyToInteraction(interaction, { content: result.error, ephemeral: true });
    return;
  }

  const player = result.player;

  if (result.finished) {
    const { ranking } = endGame(game);
    const embed = {
      color: 0xFF4500,
      title: '🏆 Partida encerrada!',
      description: `**${player.name}** marcou **${result.points}** pontos em **${CATEGORY_NAMES[category]}**.\n\n${ranking}`
    };
    await replyToInteraction(interaction, { embeds: [embed] });
    return;
  }

  await replyToInteraction(interaction, {
    content: `**${player.name}** marcou **${result.points}** pontos em **${CATEGORY_NAMES[category]}**. Rodada **${game.currentRound}/${game.rounds}**.`,
    ephemeral: true
  });

  await advanceTurn(interaction, game);
}

async function handleScoreSelection(interaction, game, category) {
  const result = scoreCurrentPlayer(game, category);
  if (result.error) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  const player = result.player;

  if (result.finished) {
    const { ranking } = endGame(game);
    const embed = {
      color: 0xFF4500,
      title: '🏆 Partida encerrada!',
      description: `**${player.name}** marcou **${result.points}** pontos em **${CATEGORY_NAMES[category]}**.\n\n${ranking}`
    };
    await interaction.reply({ embeds: [embed] });
    return;
  }

  await interaction.reply({
    content: `**${player.name}** marcou **${result.points}** pontos em **${CATEGORY_NAMES[category]}**. Rodada **${game.currentRound}/${game.rounds}**.`
  });

  await advanceTurn(interaction, game);
}

function formatGameStatus(game) {
  const players = game.players.map(player => `${player.name}: ${formatPlayerScore(game, player)}`).join('\n') || 'nenhum jogador';
  const current = game.started && !game.finished ? `\nVez atual: <@${getCurrentPlayer(game).id}>` : '';
  const mode = game.rounds === 10 ? ' (Clássico)' : '';
  return `Partida${mode}: ${game.finished ? 'encerrada' : game.started ? `rodada ${game.currentRound}/${game.rounds}` : 'aguardando jogadores'}\n${players}${current}`;
}

async function advanceTurn(interaction, game, shouldIncrement = false) {
  if (shouldIncrement) {
    if (game.currentPlayerIndex === game.players.length - 1) {
      game.currentRound += 1;
      game.currentPlayerIndex = 0;
    } else {
      game.currentPlayerIndex += 1;
    }

    if (game.currentRound > game.rounds) {
      const { ranking } = endGame(game);
      if (interaction.channel) {
        await interaction.channel.send({ content: '🏆 Partida encerrada!\n' + ranking });
      }
      return;
    }
  }

  const next = getCurrentPlayer(game);
  const embed = {
    color: 0xFEE75C,
    title: '🎲 Próxima vez',
    description: `Rodada **${game.currentRound}/${game.rounds}**.\nÉ a vez de <@${next.id}>.\nClique no botão abaixo para rolar os dados.`
  };

  const row = newActionRowRoll();
  if (interaction.channel) {
    if (game.currentPlayerIndex === 0 && game.currentRound > 1) {
      await interaction.channel.send({ content: formatGameStatus(game) });
    }
    const msg = await interaction.channel.send({ content: `<@${next.id}>`, embeds: [embed], components: [row] });
    game.rollMessageId = msg.id;
  }
}

function newActionRowCreate() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bozo_join')
      .setLabel('Entrar na Partida')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId('bozo_start')
      .setLabel('Iniciar Partida')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🚀')
  );
}

function newActionRowRoll(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bozo_roll')
      .setLabel('Rolar Dados 🎲')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎲')
      .setDisabled(disabled)
  );
}

client.login(token);