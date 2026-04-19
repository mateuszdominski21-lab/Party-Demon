require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) commands.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Rejestruję ${commands.length} komend(y)...`);
    
   await rest.put(
  Routes.applicationCommands(String(process.env.CLIENT_ID)),
  { body: commands }
);
console.log('✅ Komendy zarejestrowane globalnie (może potrwać do 1h).');
  } catch (err) {
    console.error(err);
  }
})();
