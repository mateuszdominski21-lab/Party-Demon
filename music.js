const { SlashCommandBuilder } = require('discord.js');
const { handlePlay, handleSkip, handleLoop, handleKick } = require('../music');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('play')
      .setDescription('🎵 Puść muzykę z YouTube')
      .addStringOption(opt =>
        opt.setName('query')
          .setDescription('Link YouTube lub nazwa piosenki')
          .setRequired(true)
      ),
    execute: (interaction) => handlePlay(interaction),
  },
  {
    data: new SlashCommandBuilder()
      .setName('skip')
      .setDescription('⏭️ Pomiń aktualną piosenkę'),
    execute: (interaction) => handleSkip(interaction),
  },
  {
    data: new SlashCommandBuilder()
      .setName('loop')
      .setDescription('🔁 Zapętl aktualną piosenkę')
      .addIntegerOption(opt =>
        opt.setName('ile')
          .setDescription('Ile razy zapętlić (domyślnie 10)')
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(false)
      ),
    execute: (interaction) => handleLoop(interaction),
  },
  {
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('👋 Wyrzuć bota z kanału głosowego'),
    execute: (interaction) => handleKick(interaction),
  },
];
