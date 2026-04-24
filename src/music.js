const { DisTube } = require('distube');
const { EmbedBuilder } = require('discord.js');

let distube = null;

function initDistube(client) {
  distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
  });

  distube.on('playSong', (queue, song) => {
    const embed = new EmbedBuilder()
      .setTitle('🎵 Teraz gra')
      .setDescription(`**[${song.name}](${song.url})**`)
      .addFields(
        { name: '⏱️ Czas', value: song.formattedDuration || 'Nieznany', inline: true },
        { name: '👤 Dodał', value: song.user?.username || 'Nieznany', inline: true },
      )
      .setColor(0x5865F2)
      .setThumbnail(song.thumbnail || null)
      .setTimestamp();
    queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
  });

  distube.on('addSong', (queue, song) => {
    const embed = new EmbedBuilder()
      .setTitle('📋 Dodano do kolejki')
      .setDescription(`**${song.name}**`)
      .addFields({ name: '📍 Pozycja', value: `${queue.songs.length}`, inline: true })
      .setColor(0x5865F2);
    queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
  });

  distube.on('error', (channel, error) => {
    console.error('DisTube error:', error);
    channel?.send('❌ Błąd odtwarzania: ' + error.message).catch(() => {});
  });

  distube.on('finish', (queue) => {
    queue.textChannel?.send('✅ Kolejka skończona!').catch(() => {});
  });

  return distube;
}

function getDistube() {
  return distube;
}

async function handlePlay(interaction) {
  await interaction.deferReply();

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.editReply('❌ Musisz być na kanale głosowym!');
  }

  const query = interaction.options.getString('query');

  try {
    await distube.play(voiceChannel, query, {
      member: interaction.member,
      textChannel: interaction.channel,
      interaction,
    });
    await interaction.editReply(`▶️ Szukam: **${query}**`);
  } catch (err) {
    console.error('Play error:', err);
    await interaction.editReply('❌ Błąd! Sprawdź link lub nazwę piosenki.');
  }
}

async function handleSkip(interaction) {
  const queue = distube.getQueue(interaction.guildId);
  if (!queue) {
    return interaction.reply({ content: '❌ Nic nie gra!', ephemeral: true });
  }

  try {
    await queue.skip();
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('⏭️ Pominięto!')
        .setColor(0xFEE75C)]
    });
  } catch {
    return interaction.reply({ content: '❌ Brak następnej piosenki w kolejce!', ephemeral: true });
  }
}

async function handleLoop(interaction) {
  const queue = distube.getQueue(interaction.guildId);
  if (!queue) {
    return interaction.reply({ content: '❌ Nic nie gra!', ephemeral: true });
  }

  const times = interaction.options.getInteger('ile') || 10;
  queue.setRepeatMode(1);

  let count = 0;
  const interval = setInterval(() => {
    count++;
    if (count >= times) {
      queue.setRepeatMode(0);
      clearInterval(interval);
    }
  }, (queue.songs[0]?.duration || 180) * 1000 / times);

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🔁 Pętla włączona!')
      .setDescription(`Piosenka będzie zapętlona **${times}x**`)
      .setColor(0x5865F2)]
  });
}

async function handleKick(interaction) {
  const queue = distube.getQueue(interaction.guildId);
  if (!queue) {
    return interaction.reply({ content: '❌ Bot nie jest na kanale głosowym!', ephemeral: true });
  }

  await queue.stop();
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('👋 Do zobaczenia!')
      .setDescription('Bot opuścił kanał głosowy.')
      .setColor(0xED4245)]
  });
}

module.exports = { initDistube, getDistube, handlePlay, handleSkip, handleLoop, handleKick };
