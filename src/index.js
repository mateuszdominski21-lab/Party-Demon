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
client.activeGames = new Map(); // guildId+channelId -> game state

// Ładowanie komend
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }
}

client.once('ready', () => {
  console.log(`✅ Bot zalogowany jako ${client.user.tag}`);
  client.user.setActivity('🎮 Mini Gry | /graj', { type: 0 });
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
      const msg = { content: '❌ Wystąpił błąd!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  } else if (interaction.isButton()) {
    const gameKey = `${interaction.guildId}-${interaction.channelId}`;
    const game = client.activeGames.get(gameKey);
    if (game && game.handleButton) {
      try {
        await game.handleButton(interaction);
      } catch (err) {
        console.error(err);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
