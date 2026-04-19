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

    await interaction.reply({ embeds: [embed], components: [row1, row2] });
  },
};
