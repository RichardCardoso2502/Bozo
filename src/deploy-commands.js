require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('Defina DISCORD_TOKEN e DISCORD_CLIENT_ID no arquivo .env.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Responde com a latência do bot.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('bozo-criar')
    .setDescription('Cria uma partida de Bozó.')
    .addIntegerOption(option => option
      .setName('rodadas')
      .setDescription('Quantidade de rodadas (1 a 3).')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(3))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('bozo-entrar')
    .setDescription('Entra na partida atual.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('bozo-iniciar')
    .setDescription('Inicia a partida de Bozó.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('bozo-confirmar')
    .setDescription('Confirma o turno e rola os cinco dados.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('bozo-marcar')
    .setDescription('Marca a pontuação em uma categoria.')
    .addStringOption(option => option
      .setName('categoria')
      .setDescription('Categoria para marcar.')
      .setRequired(true)
      .setAutocomplete(true)
      )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('bozo-status')
    .setDescription('Mostra o estado e a pontuação da partida.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('bozo-encerrar')
    .setDescription('Encerra a partida atual (somente o criador).')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('regras')
    .setDescription('Mostra as regras do jogo Bozó.')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

const isGuildOnly = process.argv.includes('--guild');

(async () => {
  try {
    if (isGuildOnly && DISCORD_GUILD_ID) {
      console.log(`Registrando ${commands.length} comando(s) no servidor de teste ${DISCORD_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
        { body: commands }
      );
    } else {
      console.log(`Registrando ${commands.length} comando(s) globalmente (qualquer servidor)...`);
      await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: commands }
      );
    }

    console.log('Comandos registrados com sucesso.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
