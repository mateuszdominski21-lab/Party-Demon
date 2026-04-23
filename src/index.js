require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();
client.activeGames = new Map();

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const loaded = require(path.join(commandsPath, file));
    // Support both single command and array of commands
    const commands = Array.isArray(loaded) ? loaded : [loaded];
    for (const command of commands) {
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
      }
    }
  }
}

const { startQuiz } = require('./games/quiz');
const { startMemory } = require('./games/memory');
const { startDoors } = require('./games/doors');
const { startReflex } = require('./games/reflex');
const { startEmojiGuess } = require('./games/emoji-guess');
const { startBomb } = require('./games/bomb');

client.once('ready', () => {
  console.log(`✅ Bot zalogowany jako ${client.user.tag}`);
  client.user.setActivity('🎮 Mini Gry | /graj', { type: 0 });
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);

    } else if (interaction.isButton()) {
      const gameKey = `${interaction.guildId}-${interaction.channelId}`;

      // Menu buttons - start games
      if (interaction.customId.startsWith('menu_')) {
        switch (interaction.customId) {
          case 'menu_quiz': await startQuiz(interaction, client, gameKey); break;
          case 'menu_memory': await startMemory(interaction, client, gameKey); break;
          case 'menu_doors': await startDoors(interaction, client, gameKey); break;
          case 'menu_reflex': await startReflex(interaction, client, gameKey); break;
          case 'menu_emoji': await startEmojiGuess(interaction, client, gameKey); break;
          case 'menu_bomb': await startBomb(interaction, client, gameKey); break;
        }
        return;
      }

      // Game buttons
      const game = client.activeGames.get(gameKey);
      if (game && game.handleButton) {
        await game.handleButton(interaction);
      } else {
        await interaction.reply({ content: '⏰ Ta gra już wygasła! Wpisz `/graj` żeby zacząć nową.', ephemeral: true });
      }
    }
  } catch (err) {
    console.error('Błąd interakcji:', err);
    try {
      const msg = { content: '❌ Wystąpił błąd!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
