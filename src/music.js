const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require('@discordjs/voice');
const play = require('play-dl');
const { EmbedBuilder } = require('discord.js');

// Queue per guild
const queues = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      songs: [],
      player: null,
      connection: null,
      loop: 0,
      loopCount: 0,
      currentSong: null,
      textChannel: null,
    });
  }
  return queues.get(guildId);
}

async function playSong(queue, song) {
  if (!song) {
    queue.currentSong = null;
    return;
  }

  queue.currentSong = song;

  try {
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

    queue.player.play(resource);

    queue.player.once(AudioPlayerStatus.Idle, async () => {
      if (queue.loop > 0 && queue.loopCount < queue.loop) {
        queue.loopCount++;
        await playSong(queue, song);
        return;
      }
      queue.loopCount = 0;
      queue.songs.shift();
      await playSong(queue, queue.songs[0]);
    });

    if (queue.textChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🎵 Teraz gra')
        .setDescription(`**[${song.title}](${song.url})**`)
        .addFields(
          { name: '⏱️ Czas', value: song.duration || 'Nieznany', inline: true },
          { name: '👤 Dodał', value: song.requestedBy, inline: true },
          { name: '🔁 Pętla', value: queue.loop > 0 ? `${queue.loopCount}/${queue.loop}x` : 'Wyłączona', inline: true },
        )
        .setColor(0x5865F2)
        .setThumbnail(song.thumbnail || null)
        .setTimestamp();
      queue.textChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error('Błąd odtwarzania:', err);
    if (queue.textChannel) {
      queue.textChannel.send('❌ Błąd odtwarzania piosenki, pomijam...').catch(() => {});
    }
    queue.songs.shift();
    await playSong(queue, queue.songs[0]);
  }
}

async function handlePlay(interaction) {
  await interaction.deferReply();

  const member = interaction.member;
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.editReply('❌ Musisz być na kanale głosowym!');
  }

  const query = interaction.options.getString('query');
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);
  queue.textChannel = interaction.channel;

  try {
    let songInfo;
    let url;

    // Check if it's a URL or search query
    if (query.startsWith('http')) {
      const info = await play.video_info(query);
      songInfo = info.video_details;
      url = query;
    } else {
      const results = await play.search(query, { limit: 1 });
      if (!results || results.length === 0) {
        return interaction.editReply('❌ Nie znaleziono piosenki!');
      }
      songInfo = results[0];
      url = songInfo.url;
    }

    const song = {
      title: songInfo.title || 'Nieznany tytuł',
      url: url,
      duration: songInfo.durationRaw || 'Nieznany',
      thumbnail: songInfo.thumbnails?.[0]?.url || null,
      requestedBy: interaction.user.username,
    };

    queue.songs.push(song);

    // Connect to voice if not connected
    if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      queue.connection = connection;

      const player = createAudioPlayer();
      queue.player = player;
      connection.subscribe(player);

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
        } catch {
          connection.destroy();
          queues.delete(guildId);
        }
      });

      await playSong(queue, queue.songs[0]);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('🎵 Dodano do kolejki')
          .setDescription(`**${song.title}**`)
          .setColor(0x57F287)
          .setTimestamp()]
      });
    }

    // Already connected - add to queue
    const embed = new EmbedBuilder()
      .setTitle('📋 Dodano do kolejki')
      .setDescription(`**${song.title}**`)
      .addFields({ name: '📍 Pozycja', value: `${queue.songs.length}`, inline: true })
      .setColor(0x5865F2)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('Play error:', err);
    return interaction.editReply('❌ Błąd! Sprawdź czy link jest poprawny lub spróbuj innej nazwy.');
  }
}

async function handleSkip(interaction) {
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);

  if (!queue.player || !queue.currentSong) {
    return interaction.reply({ content: '❌ Nic nie gra!', ephemeral: true });
  }

  queue.loopCount = 0;
  queue.loop = 0;
  queue.player.stop();

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('⏭️ Pominięto!')
      .setDescription(`Pominięto: **${queue.currentSong.title}**`)
      .setColor(0xFEE75C)]
  });
}

async function handleLoop(interaction) {
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);
  const times = interaction.options.getInteger('ile') || 10;

  if (!queue.currentSong) {
    return interaction.reply({ content: '❌ Nic nie gra!', ephemeral: true });
  }

  queue.loop = times;
  queue.loopCount = 0;

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🔁 Pętla włączona!')
      .setDescription(`Piosenka **${queue.currentSong.title}** będzie zapętlona **${times}x**`)
      .setColor(0x5865F2)]
  });
}

async function handleKick(interaction) {
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);

  const connection = queue.connection || getVoiceConnection(guildId);
  if (!connection) {
    return interaction.reply({ content: '❌ Bot nie jest na kanale głosowym!', ephemeral: true });
  }

  if (queue.player) queue.player.stop();
  connection.destroy();
  queues.delete(guildId);

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('👋 Do zobaczenia!')
      .setDescription('Bot opuścił kanał głosowy i wyczyścił kolejkę.')
      .setColor(0xED4245)]
  });
}

module.exports = { handlePlay, handleSkip, handleLoop, handleKick };
