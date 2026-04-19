const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROUNDS = 6;
const SAFE_LABELS = ['💰', '🎁', '⭐', '🍀', '💎', '🏆', '🌟', '🎯', '💚', '🔑'];
const BOMB_LABELS = ['💣', '🧨', '💀', '☠️', '🔴'];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

async function startBomb(interaction, client, gameKey) {
  const state = {
    userId: interaction.user.id,
    score: 0,
    streak: 0,
    round: 1,
    lives: 3,
    handleButton: null,
  };
  client.activeGames.set(gameKey, state);
  await interaction.deferUpdate();
  await showBombRound(interaction, client, gameKey, state);
}

async function showBombRound(interaction, client, gameKey, state) {
  // Number of buttons increases with round (3 → 8)
  const totalButtons = Math.min(3 + state.round, 8);
  // Number of bombs: 1 in early rounds, up to 2 later
  const bombCount = state.round >= 4 ? 2 : 1;
  const safeCount = totalButtons - bombCount;

  // Time decreases: 15s → 6s
  const timeLimit = Math.max(6000, 15000 - (state.round - 1) * 1500);

  // Build button labels
  const safePool = shuffle(SAFE_LABELS).slice(0, safeCount);
  const bombPool = shuffle(BOMB_LABELS).slice(0, bombCount);

  const buttons = shuffle([
    ...safePool.map(label => ({ label, isBomb: false })),
    ...bombPool.map(label => ({ label, isBomb: true })),
  ]);

  state.buttons = buttons;

  const livesDisplay = '❤️'.repeat(state.lives) + '🖤'.repeat(3 - state.lives);

  const embed = new EmbedBuilder()
    .setTitle(`🧨 Nie Klikaj Bomby — Runda ${state.round}/${ROUNDS}`)
    .setDescription(`Kliknij **bezpieczny** przycisk. Nie klikaj 💣!\n\u200b`)
    .addFields(
      { name: '❤️ Życia', value: livesDisplay, inline: true },
      { name: '🏆 Punkty', value: `${state.score}`, inline: true },
      { name: '🔥 Seria', value: `${state.streak}`, inline: true },
      { name: '⏱️ Czas', value: `${(timeLimit / 1000).toFixed(0)}s`, inline: true },
      { name: '💣 Bomby', value: `${bombCount}`, inline: true },
      { name: '🔘 Przyciski', value: `${totalButtons}`, inline: true },
    )
    .setColor(state.lives <= 1 ? 0xED4245 : state.lives === 2 ? 0xFEE75C : 0x57F287);

  // Build rows (max 4 per row)
  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) {
    rows.push(new ActionRowBuilder().addComponents(
      buttons.slice(i, i + 4).map((b, j) =>
        new ButtonBuilder()
          .setCustomId(`bomb_${i + j}`)
          .setLabel(b.label)
          .setStyle(ButtonStyle.Secondary)
      )
    ));
  }

  const msg = await interaction.followUp({ embeds: [embed], components: rows });

  const timeout = setTimeout(async () => {
    client.activeGames.delete(gameKey);
    state.lives--;
    state.streak = 0;

    // Reveal bombs
    const revealRows = buildRevealRows(buttons, -1);
    await msg.edit({
      embeds: [new EmbedBuilder().setTitle('⏰ Czas minął! -1 życie').setColor(0xFEE75C)],
      components: revealRows
    }).catch(() => {});

    if (state.lives <= 0) {
      await endBomb(interaction, state, 'Straciłeś wszystkie życia! 💀');
    } else {
      state.round++;
      if (state.round > ROUNDS) {
        await endBomb(interaction, state, 'Przeżyłeś!');
      } else {
        client.activeGames.set(gameKey, state);
        await showBombRound(interaction, client, gameKey, state);
      }
    }
  }, timeLimit);

  state.handleButton = async (btn) => {
    if (btn.user.id !== state.userId) return btn.reply({ content: '❌ To nie twoja gra!', ephemeral: true });
    clearTimeout(timeout);
    client.activeGames.delete(gameKey);

    const idx = parseInt(btn.customId.split('_')[1]);
    const clicked = buttons[idx];

    const revealRows = buildRevealRows(buttons, idx);

    if (clicked.isBomb) {
      state.lives--;
      state.streak = 0;

      await btn.update({
        embeds: [new EmbedBuilder()
          .setTitle('💣 BOOM! Trafiłeś bombę!')
          .setDescription(`Zostało ci ${'❤️'.repeat(state.lives)}${'🖤'.repeat(3 - state.lives)}`)
          .setColor(0xED4245)],
        components: revealRows
      });

      if (state.lives <= 0) {
        await endBomb(btn, state, 'GAME OVER! Straciłeś wszystkie życia! 💀');
        return;
      }
    } else {
      const points = 20 + state.streak * 10 + state.round * 5;
      state.score += points;
      state.streak++;

      await btn.update({
        embeds: [new EmbedBuilder()
          .setTitle('✅ Bezpiecznie!')
          .setDescription(`+${points} pkt 🎉`)
          .setColor(0x57F287)],
        components: revealRows
      });
    }

    state.round++;
    if (state.round > ROUNDS) {
      await endBomb(btn, state, state.lives > 0 ? 'Przeżyłeś wszystkie rundy!' : 'Game over!');
    } else {
      client.activeGames.set(gameKey, state);
      await showBombRound(btn, client, gameKey, state);
    }
  };

  client.activeGames.set(gameKey, state);
}

function buildRevealRows(buttons, clickedIdx) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) {
    rows.push(new ActionRowBuilder().addComponents(
      buttons.slice(i, i + 4).map((b, j) => {
        const realIdx = i + j;
        const isClicked = realIdx === clickedIdx;
        return new ButtonBuilder()
          .setCustomId(`brev_${realIdx}`)
          .setLabel(b.isBomb ? `💣 ${b.label}` : b.label)
          .setStyle(b.isBomb ? ButtonStyle.Danger : (isClicked ? ButtonStyle.Success : ButtonStyle.Secondary))
          .setDisabled(true);
      })
    ));
  }
  return rows;
}

async function endBomb(interaction, state, reason) {
  const embed = new EmbedBuilder()
    .setTitle('🧨 Koniec Gry — Nie Klikaj Bomby')
    .setDescription(reason)
    .addFields(
      { name: '🏆 Wynik końcowy', value: `**${state.score} punktów**`, inline: true },
      { name: '❤️ Pozostałe życia', value: `${state.lives}`, inline: true },
    )
    .setColor(state.lives > 0 ? 0x57F287 : 0xED4245)
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });
}

module.exports = { startBomb };
