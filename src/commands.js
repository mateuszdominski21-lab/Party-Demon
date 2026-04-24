require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const loaded = require(path.join(commandsPath, file));
  const cmds = Array.isArray(loaded) ? loaded : [loaded];
  for (const command of cmds) {
    if (command.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Rejestruję ${commands.length} komend(y)...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID.trim().replace(/[^0-9]/g, '')),
      { body: commands }
    );
    console.log('✅ Komendy zarejestrowane globalnie (może potrwać do 1h).');
  } catch (err) {
    console.error(err);
  }
})();
