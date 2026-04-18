const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROUNDS = 6;
const EMOJIS = ['⚡', '💥', '🎯', '🌟', '🔥', '💎', '🚀', '🎮'];

async function startReflex(interaction, client, gameKey) {
  const state = {
    userId: interaction.user.id,
    score: 0,
    streak: 0,
    round: 1,
    handleButton: null,
  };
  client.activeGames.set(gameKey, state);
  await interaction.update({ components: [], embeds: [] });
  await nextReflexRound(interaction, client, gameKey, state);
}

async function nextReflexRound(interaction, client, gameKey, state) {
  // Delay before showing button (0.5s - 2.5s)
  const delay = 500 + Math.random() * 2000;
  // Button visible time (decreases each round: 3s → 0.8s)
  const visibleTime = Math.max(800, 3000 - (state.round - 1) * 450);

  const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  const isFake = Math.random() < 0.25 && state.round > 2; // 25% fake after round 2

  const waitEmbed = new EmbedBuilder()
    .setTitle(`⚡ Refleks — Runda ${state.round}/${ROUNDS}`)
    .setDescription('👀 Czekaj na przycisk...\n\u200b')
    .addFields(
      { name: '🏆 Punkty', value: `${state.score}`, inline: true },
      { name: '🔥 Seria', value: `${state.streak}`, inline: true },
      { name: '⏱️ Czas okna', value: `${(visibleTime / 1000).toFixed(1)}s`, inline: true },
    )
    .setColor(0x99AAB5);

  const msg = await interaction.followUp({ embeds: [waitEmbed], components: [] });

  // Wait, then show button
  setTimeout(async () => {
    if (isFake) {
      await showFakeButton(msg, interaction, client, gameKey, state, emoji, visibleTime);
    } else {
      await showRealButton(msg, interaction, client, gameKey, state, emoji, visibleTime);
    }
  }, delay);
}

async function showRealButton(msg, interaction, client, gameKey, state, emoji, visibleTime) {
  const embed = new EmbedBuilder()
    .setTitle(`⚡ KLIKNIJ TERAZ!`)
    .setDescription(`## ${emoji} ${emoji} ${emoji}`)
    .setColor(0x57F287)
    .setFooter({ text: `Masz ${(visibleTime / 1000).toFixed(1)}s!` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('reflex_click')
      .setLabel(`${emoji} KLIKNIJ!`)
      .setStyle(ButtonStyle.Success)
  );

  await msg.edit({ embeds: [embed], components: [row] });
  const shownAt = Date.now();

  const timeout = setTimeout(async () => {
    client.activeGames.delete(gameKey);
    state.streak = 0;
    await msg.edit({
      embeds: [new EmbedBuilder().setTitle('⏰ Za wolno!').setDescription(`Zniknął po ${(visibleTime / 1000).toFixed(1)}s`).setColor(0xED4245)],
      components: []
    }).catch(() => {});

    state.round++;
    if (state.round > ROUNDS) {
      await endReflex(interaction, state);
    } else {
      client.activeGames.set(gameKey, state);
      await nextReflexRound(interaction, client, gameKey, state);
    }
  }, visibleTime);

  state.handleButton = async (btn) => {
    if (btn.user.id !== state.userId) return btn.reply({ content: '❌ To nie twoja gra!', ephemeral: true });
    if (btn.customId !== 'reflex_click') return;
    clearTimeout(timeout);
    client.activeGames.delete(gameKey);

    const reactionTime = Date.now() - shownAt;
    const points = Math.max(10, Math.round(200 - reactionTime / 10) + state.streak * 5);
    state.score += points;
    state.streak++;

    await btn.update({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Kliknąłeś!')
        .setDescription(`Czas: **${reactionTime}ms** ⚡\n+${points} pkt`)
        .setColor(0x57F287)],
      components: []
    });

    state.round++;
    if (state.round > ROUNDS) {
      await endReflex(btn, state);
    } else {
      client.activeGames.set(gameKey, state);
      await nextReflexRound(btn, client, gameKey, state);
    }
  };

  client.activeGames.set(gameKey, state);
}

async function showFakeButton(msg, interaction, client, gameKey, state, emoji, visibleTime) {
  const fakeEmojis = ['🚫', '❌', '💣', '☠️'];
  const fakeEmoji = fakeEmojis[Math.floor(Math.random() * fakeEmojis.length)];

  const embed = new EmbedBuilder()
    .setTitle(`🤫 Nie klikaj!`)
    .setDescription(`## ${fakeEmoji} NIE KLIKAJ ${fakeEmoji}`)
    .setColor(0xED4245)
    .setFooter({ text: 'To fałszywy przycisk! Poczekaj...' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('reflex_fake')
      .setLabel(`${fakeEmoji} PUŁAPKA`)
      .setStyle(ButtonStyle.Danger)
  );

  await msg.edit({ embeds: [embed], components: [row] });

  const timeout = setTimeout(async () => {
    // Player didn't click fake — reward!
    client.activeGames.delete(gameKey);
    state.score += 25;
    state.streak++;
    await msg.edit({
      embeds: [new EmbedBuilder().setTitle('👏 Dobrze! Nie dałeś się!').setDescription('+25 pkt za unikanie pułapki!').setColor(0x57F287)],
      components: []
    }).catch(() => {});

    state.round++;
    if (state.round > ROUNDS) {
      await endReflex(interaction, state);
    } else {
      client.activeGames.set(gameKey, state);
      await nextReflexRound(interaction, client, gameKey, state);
    }
  }, visibleTime);

  state.handleButton = async (btn) => {
    if (btn.user.id !== state.userId) return btn.reply({ content: '❌ To nie twoja gra!', ephemeral: true });
    if (btn.customId !== 'reflex_fake') return;
    clearTimeout(timeout);
    client.activeGames.delete(gameKey);
    state.streak = 0;

    await btn.update({
      embeds: [new EmbedBuilder().setTitle('💀 Kliknąłeś pułapkę!').setDescription('Tracisz serię!').setColor(0xED4245)],
      components: []
    });

    state.round++;
    if (state.round > ROUNDS) {
      await endReflex(btn, state);
    } else {
      client.activeGames.set(gameKey, state);
      await nextReflexRound(btn, client, gameKey, state);
    }
  };

  client.activeGames.set(gameKey, state);
}

async function endReflex(interaction, state) {
  const rank = state.score >= 800 ? '⚡ Szybki jak błyskawica!' : state.score >= 400 ? '🏃 Szybki!' : '🐢 Ćwicz refleksy!';
  const embed = new EmbedBuilder()
    .setTitle('⚡ Koniec Testu Refleksów!')
    .setDescription(rank)
    .addFields({ name: '🏆 Wynik końcowy', value: `**${state.score} punktów**` })
    .setColor(0x5865F2)
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });
}

module.exports = { startReflex };
