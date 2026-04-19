const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MAX_ROUNDS = 6;

const OUTCOMES = {
  jackpot: { label: '🎰 JACKPOT!!!', points: 100, color: 0xFFD700, msg: 'Trafiłeś JACKPOTA! Niesamowite!' },
  win:     { label: '🎉 Nagroda!',   points: 30,  color: 0x57F287, msg: 'Za drzwiami była nagroda!' },
  nothing: { label: '😐 Nic...',     points: 5,   color: 0x99AAB5, msg: 'Za drzwiami było pusto...' },
  trap:    { label: '💀 Pułapka!',  points: 0,   color: 0xED4245, msg: 'Wpadłeś w pułapkę! Tracisz serię!' },
};

function rollOutcome(streak) {
  const rand = Math.random();
  // hidden jackpot: 3% base, grows with streak
  const jackpotChance = Math.min(0.15, 0.03 + streak * 0.02);
  if (rand < jackpotChance) return 'jackpot';
  if (rand < jackpotChance + 0.40) return 'win';
  if (rand < jackpotChance + 0.70) return 'nothing';
  return 'trap';
}

async function startDoors(interaction, client, gameKey) {
  const state = {
    userId: interaction.user.id,
    score: 0,
    streak: 0,
    maxStreak: 0,
    round: 1,
    handleButton: null,
  };
  client.activeGames.set(gameKey, state);
  await interaction.deferUpdate();
  await showDoors(interaction, client, gameKey, state);
}

async function showDoors(interaction, client, gameKey, state) {
  const embed = new EmbedBuilder()
    .setTitle(`🚪 Wybierz Drzwi — Runda ${state.round}/${MAX_ROUNDS}`)
    .setDescription('Za jednym kryje się nagroda, za innym pułapka... Wybierz mądrze!\n\u200b')
    .addFields(
      { name: '🏆 Punkty', value: `${state.score}`, inline: true },
      { name: '🔥 Seria', value: `${state.streak}`, inline: true },
      { name: '💡 Hint', value: state.streak >= 3 ? `Jackpot coraz bliżej! (seria: ${state.streak})` : 'Zbuduj serię po nagrodę!', inline: true },
    )
    .setColor(0x5865F2)
    .setFooter({ text: '⏱️ Masz 20 sekund' });

  const row = new ActionRowBuilder().addComponents(
    ['🚪1', '🚪2', '🚪3'].map((label, i) =>
      new ButtonBuilder()
        .setCustomId(`door_${i}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const msg = await interaction.followUp({ embeds: [embed], components: [row] });

  const timeout = setTimeout(async () => {
    client.activeGames.delete(gameKey);
    await msg.edit({
      embeds: [new EmbedBuilder().setTitle('⏰ Czas minął!').setDescription('Za wolno!').setColor(0xFEE75C)],
      components: []
    }).catch(() => {});
  }, 20000);

  state.handleButton = async (btn) => {
    if (btn.user.id !== state.userId) return btn.reply({ content: '❌ To nie twoja gra!', ephemeral: true });
    clearTimeout(timeout);
    client.activeGames.delete(gameKey);

    const chosenIdx = parseInt(btn.customId.split('_')[1]);
    const outcomeKey = rollOutcome(state.streak);
    const outcome = OUTCOMES[outcomeKey];

    if (outcomeKey === 'trap') {
      state.streak = 0;
    } else {
      state.score += outcome.points + state.streak * 5;
      state.streak++;
      state.maxStreak = Math.max(state.maxStreak, state.streak);
    }

    // Reveal all doors
    const revealRow = new ActionRowBuilder().addComponents(
      ['🚪1', '🚪2', '🚪3'].map((label, i) => {
        const isChosen = i === chosenIdx;
        return new ButtonBuilder()
          .setCustomId(`rev_${i}`)
          .setLabel(isChosen ? `${label} ← ${outcome.label}` : label)
          .setStyle(isChosen
            ? (outcomeKey === 'trap' ? ButtonStyle.Danger : outcomeKey === 'jackpot' ? ButtonStyle.Success : ButtonStyle.Primary)
            : ButtonStyle.Secondary)
          .setDisabled(true);
      })
    );

    const resultEmbed = new EmbedBuilder()
      .setTitle(outcome.label)
      .setDescription(outcome.msg)
      .addFields(
        { name: '🏆 Punkty', value: `${state.score}`, inline: true },
        { name: '🔥 Seria', value: `${state.streak}`, inline: true },
      )
      .setColor(outcome.color);

    await btn.update({ embeds: [resultEmbed], components: [revealRow] });

    state.round++;
    if (state.round > MAX_ROUNDS) {
      await endDoors(btn, state);
    } else {
      client.activeGames.set(gameKey, state);
      await showDoors(btn, client, gameKey, state);
    }
  };

  client.activeGames.set(gameKey, state);
}

async function endDoors(interaction, state) {
  const embed = new EmbedBuilder()
    .setTitle('🚪 Koniec Gry!')
    .addFields(
      { name: '🏆 Wynik końcowy', value: `**${state.score} punktów**`, inline: true },
      { name: '🔥 Najdłuższa seria', value: `${state.maxStreak}`, inline: true },
    )
    .setColor(0x5865F2)
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });
}

module.exports = { startDoors };
