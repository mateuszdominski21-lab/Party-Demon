const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { EmbedBuilder } = require('discord.js');

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
    const stream = ytdl(song.url, {
      filter: 'audioonly',
      quality: 'lowestAudio',
      highWaterMark: 1 << 25,
    });

    const resource = createAudioResource(stream);
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
      queue.textChannel.send('❌ Błąd odtwarzania, pomijam...').catch(() => {});
    }
    queue.songs.shift();
    await playSong(queue, queue.songs[0]);
  }
}

async function searchYoutube(query) {
  if (ytdl.validateURL(query)) {
    const info = await ytdl.getInfo(query);
    return {
      title: info.videoDetails.title,
      url: query,
      duration: formatDuration(parseInt(info.videoDetails.lengthSeconds)),
      thumbnail: info.videoDetails.thumbnails[0]?.url || null,
    };
  }
  // Search by title using YouTube search URL
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl);
  const html = await response.text();
  const match = html.match(/"videoId":"([^"]+)"/);
  if (!match) throw new Error('Nie znaleziono piosenki');
  const videoUrl = `https://www.youtube.com/watch?v=${match[1]}`;
  const info = await ytdl.getInfo(videoUrl);
  return {
    title: info.videoDetails.title,
    url: videoUrl,
    duration: formatDuration(parseInt(info.videoDetails.lengthSeconds)),
    thumbnail: info.videoDetails.thumbnails[0]?.url || null,
  };
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function handlePlay(interaction) {
  await interaction.deferReply();

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.editReply('❌ Musisz być na kanale głosowym!');
  }

  const query = interaction.options.getString('query');
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);
  queue.textChannel = interaction.channel;

  try {
    const song = await searchYoutube(query);
    song.requestedBy = interaction.user.username;
    queue.songs.push(song);

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
            new Promise((_, r) => setTimeout(r, 5000)),
          ]);
        } catch {
          connection.destroy();
          queues.delete(guildId);
        }
      });

      await playSong(queue, queue.songs[0]);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('🎵 Odtwarzam!')
          .setDescription(`**${song.title}**`)
          .setColor(0x57F287)]
      });
    }

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('📋 Dodano do kolejki')
        .setDescription(`**${song.title}**`)
        .addFields({ name: '📍 Pozycja', value: `${queue.songs.length}`, inline: true })
        .setColor(0x5865F2)]
    });

  } catch (err) {
    console.error('Play error:', err);
    return interaction.editReply('❌ Błąd! Sprawdź link lub nazwę piosenki.');
  }
}

async function handleSkip(interaction) {
  const queue = getQueue(interaction.guildId);
  if (!queue.player || !queue.currentSong) {
    return interaction.reply({ content: '❌ Nic nie gra!', ephemeral: true });
  }
  queue.loopCount = 0;
  queue.loop = 0;
  queue.player.stop();
  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('⏭️ Pominięto!').setColor(0xFEE75C)]
  });
}

async function handleLoop(interaction) {
  const queue = getQueue(interaction.guildId);
  if (!queue.currentSong) {
    return interaction.reply({ content: '❌ Nic nie gra!', ephemeral: true });
  }
  const times = interaction.options.getInteger('ile') || 10;
  queue.loop = times;
  queue.loopCount = 0;
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🔁 Pętla włączona!')
      .setDescription(`Zapętlono **${times}x**`)
      .setColor(0x5865F2)]
  });
}

async function handleKick(interaction) {
  const queue = getQueue(interaction.guildId);
  const connection = queue.connection || getVoiceConnection(interaction.guildId);
  if (!connection) {
    return interaction.reply({ content: '❌ Bot nie jest na kanale!', ephemeral: true });
  }
  if (queue.player) queue.player.stop();
  connection.destroy();
  queues.delete(interaction.guildId);
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('👋 Do zobaczenia!')
      .setColor(0xED4245)]
  });
}

module.exports = { handlePlay, handleSkip, handleLoop, handleKick };
