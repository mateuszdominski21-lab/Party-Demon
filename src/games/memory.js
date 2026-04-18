const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const EMOJI_POOL = ['🍎', '🍌', '🍕', '🐶', '🐱', '🌟', '🔥', '💎', '🎮', '🚀', '🌈', '⚡'];
const SIMILAR_POOL = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🥭', '🍍']; // harder mode

const BASE_TIME_MS = 3000; // sequence display time
const MAX_ROUNDS = 5;

async function startMemory(interaction, client, gameKey) {
  const state = {
    userId: interaction.user.id,
    score: 0,
    round: 1,
    sequence: [],
    playerSequence: [],
    handleButton: null,
  };
  client.activeGames.set(gameKey, state);
  await interaction.update({ components: [], embeds: [] });
  await showRound(interaction, client, gameKey, state);
}

function buildSequence(round) {
  const length = 2 + round; // round1=3, round5=7
  const hard = round >= 4;
  const pool = hard ? [...EMOJI_POOL, ...SIMILAR_POOL] : EMOJI_POOL;
  const seq = [];
  for (let i = 0; i < length; i++) {
    seq.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return seq;
}

async function showRound(interaction, client, gameKey, state) {
  state.sequence = buildSequence(state.round);
  state.playerSequence = [];

  const displayTime = Math.max(1500, BASE_TIME_MS - (state.round - 1) * 400);

  const showEmbed = new EmbedBuilder()
    .setTitle(`🧠 Zapamiętaj Sekwencję — Runda ${state.round}/${MAX_ROUNDS}`)
    .setDescription(`## ${state.sequence.join('  ')}\n\n⏱️ Zapamiętaj! Znika za **${(displayTime / 1000).toFixed(1)}s**`)
    .setColor(0x5865F2)
    .addFields({ name: '🏆 Punkty', value: `${state.score}`, inline: true });

  const msg = await interaction.followUp({ embeds: [showEmbed], components: [] });

  // After display time, hide the sequence and show buttons
  setTimeout(async () => {
    await showInputPhase(msg, interaction, client, gameKey, state);
  }, displayTime);
}

async function showInputPhase(msg, interaction, client, gameKey, state) {
  // Create a pool of unique emojis for buttons (correct ones + decoys)
  const allEmojis = [...new Set(state.sequence)];
  const pool = state.round >= 4 ? SIMILAR_POOL : EMOJI_POOL;
  while (allEmojis.length < Math.min(8, pool.length)) {
    const e = pool[Math.floor(Math.random() * pool.length)];
    if (!allEmojis.includes(e)) allEmojis.push(e);
  }
  const shuffled = allEmojis.sort(() => Math.random() - 0.5).slice(0, 8);

  state.availableEmojis = shuffled;

  const embed = new EmbedBuilder()
    .setTitle(`🧠 Kliknij w tej samej kolejności!`)
    .setDescription(`Sekwencja miała **${state.sequence.length}** emoji.\nWpisz: ${state.playerSequence.length > 0 ? state.playerSequence.join(' ') : '*(czekam...)*'}`)
    .addFields(
      { name: 'Postęp', value: `${state.playerSequence.length}/${state.sequence.length}`, inline: true },
      { name: '🏆 Punkty', value: `${state.score}`, inline: true },
    )
    .setColor(0xFEE75C)
    .setFooter({ text: '⏱️ Masz 20 sekund!' });

  const rows = buildEmojiRows(shuffled, state.playerSequence.length === 0 ? false : false);

  await msg.edit({ embeds: [embed], components: rows });

  const timeout = setTimeout(async () => {
    await failRound(msg, interaction, client, gameKey, state, '⏰ Czas minął!');
  }, 20000);

  state.handleButton = async (btn) => {
    if (btn.user.id !== state.userId) return btn.reply({ content: '❌ To nie twoja gra!', ephemeral: true });

    const emoji = btn.customId.replace('mem_', '');
    state.playerSequence.push(emoji);

    const expected = state.sequence[state.playerSequence.length - 1];
    const justAdded = state.playerSequence[state.playerSequence.length - 1];

    if (justAdded !== state.sequence[state.playerSequence.length - 1]) {
      clearTimeout(timeout);
      await btn.deferUpdate();
      await failRound(msg, btn, client, gameKey, state, `❌ Błąd! Kliknąłeś **${justAdded}**, ale powinno być **${state.sequence[state.playerSequence.length - 1]}**`);
      return;
    }

    if (state.playerSequence.length === state.sequence.length) {
      clearTimeout(timeout);
      await btn.deferUpdate();
      const points = 20 + state.round * 10;
      state.score += points;

      if (state.round >= MAX_ROUNDS) {
        await endMemory(msg, btn, state);
      } else {
        await btn.followUp({ embeds: [new EmbedBuilder().setTitle('✅ Dobrze!').setDescription(`+${points} pkt 🎉`).setColor(0x57F287)] });
        state.round++;
        client.activeGames.set(gameKey, state);
        await showRound(btn, client, gameKey, state);
      }
    } else {
      // Update display
      const newEmbed = new EmbedBuilder()
        .setTitle(`🧠 Kliknij w tej samej kolejności!`)
        .setDescription(`Wpisane: ${state.playerSequence.join(' ')} ❓`.padEnd(3))
        .addFields(
          { name: 'Postęp', value: `${state.playerSequence.length}/${state.sequence.length}`, inline: true },
          { name: '🏆 Punkty', value: `${state.score}`, inline: true },
        )
        .setColor(0xFEE75C);
      await btn.update({ embeds: [newEmbed], components: buildEmojiRows(shuffled) });
    }
  };

  client.activeGames.set(gameKey, state);
}

function buildEmojiRows(emojis, disabled = false) {
  const rows = [];
  for (let i = 0; i < emojis.length; i += 4) {
    const chunk = emojis.slice(i, i + 4);
    rows.push(new ActionRowBuilder().addComponents(
      chunk.map(e => new ButtonBuilder()
        .setCustomId(`mem_${e}`)
        .setLabel(e)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled))
    ));
  }
  return rows;
}

async function failRound(msg, interaction, client, gameKey, state, reason) {
  client.activeGames.delete(gameKey);

  const embed = new EmbedBuilder()
    .setTitle('💥 Koniec!')
    .setDescription(`${reason}\n\nPoprawna sekwencja była:\n## ${state.sequence.join('  ')}`)
    .addFields({ name: '🏆 Wynik końcowy', value: `${state.score} punktów` })
    .setColor(0xED4245);

  await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
  await interaction.followUp({ embeds: [embed] }).catch(() => {});
}

async function endMemory(msg, interaction, state) {
  const embed = new EmbedBuilder()
    .setTitle('🧠 Pamięć jak słoń!')
    .setDescription('Ukończyłeś wszystkie rundy!')
    .addFields({ name: '🏆 Wynik końcowy', value: `**${state.score} punktów**` })
    .setColor(0x57F287)
    .setTimestamp();

  await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
  await interaction.followUp({ embeds: [embed] });
}

module.exports = { startMemory };
