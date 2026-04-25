const { EmbedBuilder } = require('discord.js');
const { Shoukaku, Connectors } = require('shoukaku');

const LavalinkNodes = [{
  name: 'main',
  url: `${process.env.LAVALINK_HOST || 'lavalink.railway.internal'}:${process.env.LAVALINK_PORT || '2333'}`,
  auth: process.env.LAVALINK_PASSWORD || 'partydemonsecret',
  secure: false,
}];

const queues = new Map();
let shoukaku = null;

function initShoukaku(client) {
  shoukaku = new Shoukaku(new Connectors.DiscordJS(client), LavalinkNodes, {
    reconnectTries: 3,
    reconnectInterval: 5000,
    restTimeout: 10000,
  });

  shoukaku.on('error', (_, error) => console.error('Shoukaku error:', error));
  shoukaku.on('ready', (name) => console.log(`✅ Lavalink node ${name} ready!`));
  
  return shoukaku;
}

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      songs: [],
      player: null,
      loop: 0,
      loopCount: 0,
      currentSong: null,
      textChannel: null,
    });
  }
  return queues.get(guildId);
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
    // Get node
    const node = shoukaku.getIdealNode();
    if (!node) return interaction.editReply('❌ Lavalink nie jest dostępny!');

    // Search
    const isUrl = query.startsWith('http');
    const result = await node.rest.resolve(isUrl ? query : `ytsearch:${query}`);
    
    if (!result || !result.data || result.loadType === 'empty' || result.loadType === 'error') {
      return interaction.editReply('❌ Nie znaleziono piosenki!');
    }

    const track = result.loadType === 'playlist' 
      ? result.data.tracks[0] 
      : Array.isArray(result.data) ? result.data[0] : result.data;

    if (!track) return interaction.editReply('❌ Nie znaleziono piosenki!');

    const song = {
      encoded: track.encoded,
      title: track.info.title,
      url: track.info.uri,
      duration: formatDuration(track.info.length),
      thumbnail: track.info.artworkUrl || null,
      requestedBy: interaction.user.username,
    };

    queue.songs.push(song);

    // Connect if not connected
    if (!queue.player) {
      const player = await shoukaku.joinVoiceChannel({
        guildId: guildId,
        channelId: voiceChannel.id,
        shardId: interaction.guild.shardId || 0,
      });

      queue.player = player;

      player.on('end', async () => {
        if (queue.loop > 0 && queue.loopCount < queue.loop) {
          queue.loopCount++;
          await playNext(queue, guildId);
          return;
        }
        queue.loopCount = 0;
        queue.songs.shift();
        if (queue.songs.length > 0) {
          await playNext(queue, guildId);
        } else {
          queue.currentSong = null;
          queue.textChannel?.send('✅ Kolejka skończona!').catch(() => {});
        }
      });

      player.on('exception', (err) => {
        console.error('Player exception:', err);
        queue.textChannel?.send('❌ Błąd odtwarzania!').catch(() => {});
      });

      await playNext(queue, guildId);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('🎵 Odtwarzam!')
          .setDescription(`**${song.title}**`)
          .addFields({ name: '⏱️ Czas', value: song.duration, inline: true })
          .setColor(0x57F287)
          .setTimestamp()]
      });
    }

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('📋 Dodano do kolejki')
        .setDescription(`**${song.title}**`)
        .addFields({ name: '📍 Pozycja', value: `${queue.songs.length}`, inline: true })
        .setColor(0x5865F2)
        .setTimestamp()]
    });

  } catch (err) {
    console.error('Play error:', err);
    return interaction.editReply('❌ Błąd: ' + err.message);
  }
}

async function playNext(queue, guildId) {
  const song = queue.songs[0];
  if (!song || !queue.player) return;
  queue.currentSong = song;

  await queue.player.playTrack({ track: { encoded: song.encoded } });

  if (queue.textChannel) {
    const embed = new EmbedBuilder()
      .setTitle('🎵 Teraz gra')
      .setDescription(`**[${song.title}](${song.url})**`)
      .addFields(
        { name: '⏱️ Czas', value: song.duration, inline: true },
        { name: '👤 Dodał', value: song.requestedBy, inline: true },
        { name: '🔁 Pętla', value: queue.loop > 0 ? `${queue.loopCount}/${queue.loop}x` : 'Wyłączona', inline: true },
      )
      .setColor(0x5865F2)
      .setThumbnail(song.thumbnail)
      .setTimestamp();
    queue.textChannel.send({ embeds: [embed] }).catch(() => {});
  }
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

async function handleSkip(interaction) {
  const queue = getQueue(interaction.guildId);
  if (!queue.player || !queue.currentSong) {
    return interaction.reply({ content: '❌ Nic nie gra!', ephemeral: true });
  }
  queue.loopCount = 0;
  queue.loop = 0;
  await queue.player.stopTrack();
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
  if (!queue.player) {
    return interaction.reply({ content: '❌ Bot nie jest na kanale!', ephemeral: true });
  }
  await queue.player.disconnect();
  queues.delete(interaction.guildId);
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('👋 Do zobaczenia!')
      .setColor(0xED4245)]
  });
}

module.exports = { initShoukaku, handlePlay, handleSkip, handleLoop, handleKick };
