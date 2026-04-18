const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('graj')
    .setDescription('🎮 Uruchom mini grę!'),

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setTitle('🎮 Mini Gry — Wybierz grę!')
      .setDescription('Kliknij przycisk poniżej żeby uruchomić grę.')
      .setColor(0x5865F2)
      .addFields(
        { name: '🔢 Quiz Matematyczny', value: 'Pytania + rosnący poziom trudności', inline: true },
        { name: '🧠 Zapamiętaj Sekwencję', value: 'Zapamiętaj i kliknij emoji w kolejności', inline: true },
        { name: '🚪 Wybierz Drzwi', value: 'Szczęście czy kara? Wybierz drzwi!', inline: true },
        { name: '⚡ Kliknij Zanim Zniknie', value: 'Szybkie refleksy — kliknij zanim zniknie!', inline: true },
        { name: '🎭 Zgadnij z Emoji', value: 'Jaki film/gra kryje się za emoji?', inline: true },
        { name: '🧨 Nie Klikaj Bomby!', value: 'Znajdź bezpieczny przycisk — unikaj bomby!', inline: true },
      )
      .setFooter({ text: 'Wybierz grę poniżej' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('menu_quiz').setLabel('🔢 Quiz').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('menu_memory').setLabel('🧠 Sekwencja').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('menu_doors').setLabel('🚪 Drzwi').setStyle(ButtonStyle.Primary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('menu_reflex').setLabel('⚡ Refleks').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('menu_emoji').setLabel('🎭 Zgadnij Emoji').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('menu_bomb').setLabel('🧨 Bomba').setStyle(ButtonStyle.Danger),
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row1, row2], fetchReply: true });

    const gameKey = `${interaction.guildId}-${interaction.channelId}`;

    const collector = reply.createMessageComponentCollector({ time: 30000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: '❌ To nie twoje menu!', ephemeral: true });
      }
      collector.stop();

      const { startQuiz } = require('../games/quiz');
      const { startMemory } = require('../games/memory');
      const { startDoors } = require('../games/doors');
      const { startReflex } = require('../games/reflex');
      const { startEmojiGuess } = require('../games/emoji-guess');
      const { startBomb } = require('../games/bomb');

      switch (btn.customId) {
        case 'menu_quiz': await startQuiz(btn, client, gameKey); break;
        case 'menu_memory': await startMemory(btn, client, gameKey); break;
        case 'menu_doors': await startDoors(btn, client, gameKey); break;
        case 'menu_reflex': await startReflex(btn, client, gameKey); break;
        case 'menu_emoji': await startEmojiGuess(btn, client, gameKey); break;
        case 'menu_bomb': await startBomb(btn, client, gameKey); break;
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};
