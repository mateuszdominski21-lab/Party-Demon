const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CATEGORIES = {
  filmy: [
    { emoji: '🧙‍♂️ 💍 🌋', answer: 'Władca Pierścieni', hint: 'Fantasy epickie' },
    { emoji: '🦁 👑 🌅', answer: 'Król Lew', hint: 'Animacja Disney' },
    { emoji: '🕷️ 🏙️ 🦸', answer: 'Spider-Man', hint: 'Superbohater Marvel' },
    { emoji: '🚢 ❄️ 💔', answer: 'Titanic', hint: 'Romans na statku' },
    { emoji: '🌊 🤿 🐠', answer: 'Gdzie jest Nemo?', hint: 'Animacja podwodna' },
    { emoji: '👻 🏠 🎃', answer: 'Ghostbusters', hint: 'Łapacze duchów' },
    { emoji: '🦈 🏖️ 😱', answer: 'Szczęki', hint: 'Horror o rekinie' },
    { emoji: '⏰ 🚗 ⚡', answer: 'Powrót do Przyszłości', hint: 'Podróż w czasie' },
    { emoji: '🦍 🏙️ 🔝', answer: 'King Kong', hint: 'Wielka małpa' },
    { emoji: '🎭 🃏 💜', answer: 'Joker', hint: 'Złoczyńca DC' },
  ],
  gry: [
    { emoji: '🍄 👸 🏰', answer: 'Super Mario', hint: 'Nintendo klasyk' },
    { emoji: '⚔️ 🛡️ 🐉', answer: 'The Legend of Zelda', hint: 'Link i Ganon' },
    { emoji: '🎮 🔫 🏝️', answer: 'Fortnite', hint: 'Battle Royale' },
    { emoji: '⛏️ 🌍 🏗️', answer: 'Minecraft', hint: 'Klockowy świat' },
    { emoji: '🤖 ⚔️ 🌌', answer: 'Star Wars Jedi', hint: 'Jedi i miecz świetlny' },
    { emoji: '🏎️ 🏁 🌍', answer: 'Mario Kart', hint: 'Wyścigi Nintendo' },
    { emoji: '🧟 🔫 🏚️', answer: 'Resident Evil', hint: 'Horror ze zombie' },
    { emoji: '🔮 🧙 🃏', answer: 'Hearthstone', hint: 'Karciana Blizzard' },
  ],
  memy: [
    { emoji: '🐸 ☕', answer: 'But That\'s None of My Business', hint: 'Kermit z herbatą' },
    { emoji: '🙈 😂 💀', answer: 'Coffin Dance', hint: 'Wirusowy taniec pogrzebowy' },
    { emoji: '🐶 🔥 ☕', answer: 'This Is Fine', hint: 'Pies w ogniu' },
    { emoji: '👴 📱 😤', answer: 'Okay Boomer', hint: 'Generacyjny meme' },
    { emoji: '🤔 💭 ❓', answer: 'Thinking Emoji', hint: 'Klasyczny Discord meme' },
  ],
};

const ALL_QUESTIONS = [
  ...CATEGORIES.filmy.map(q => ({ ...q, category: '🎬 Film' })),
  ...CATEGORIES.gry.map(q => ({ ...q, category: '🎮 Gra' })),
  ...CATEGORIES.memy.map(q => ({ ...q, category: '😂 Mem' })),
];

const ROUNDS = 5;

function getQuestion(used) {
  const available = ALL_QUESTIONS.filter((_, i) => !used.has(i));
  if (available.length === 0) return null;
  const idx = Math.floor(Math.random() * available.length);
  const globalIdx = ALL_QUESTIONS.indexOf(available[idx]);
  return { question: available[idx], index: globalIdx };
}

function buildAnswerButtons(correct, all) {
  // Pick 3 wrong answers
  const wrongs = all
    .filter(q => q.answer !== correct)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(q => q.answer);

  const choices = [correct, ...wrongs].sort(() => Math.random() - 0.5);
  return choices;
}

async function startEmojiGuess(interaction, client, gameKey) {
  const state = {
    userId: interaction.user.id,
    score: 0,
    round: 1,
    usedQuestions: new Set(),
    handleButton: null,
  };
  client.activeGames.set(gameKey, state);
  await interaction.update({ components: [], embeds: [] });
  await askEmojiQuestion(interaction, client, gameKey, state);
}

async function askEmojiQuestion(interaction, client, gameKey, state) {
  const { question, index } = getQuestion(state.usedQuestions) || {};
  if (!question) {
    await endEmojiGuess(interaction, state);
    return;
  }
  state.usedQuestions.add(index);
  state.currentAnswer = question.answer;

  const choices = buildAnswerButtons(question.answer, ALL_QUESTIONS);
  const shownAt = Date.now();

  const embed = new EmbedBuilder()
    .setTitle(`🎭 Zgadnij po Emoji — Pytanie ${state.round}/${ROUNDS}`)
    .setDescription(`# ${question.emoji}`)
    .addFields(
      { name: '📂 Kategoria', value: question.category, inline: true },
      { name: '💡 Podpowiedź', value: question.hint, inline: true },
      { name: '🏆 Punkty', value: `${state.score}`, inline: true },
    )
    .setColor(0xEB459E)
    .setFooter({ text: '⏱️ Punkty za szybkość! Masz 20s' });

  const rows = [];
  for (let i = 0; i < choices.length; i += 2) {
    rows.push(new ActionRowBuilder().addComponents(
      choices.slice(i, i + 2).map((c, j) =>
        new ButtonBuilder()
          .setCustomId(`emoji_${i + j}`)
          .setLabel(c.length > 80 ? c.slice(0, 77) + '...' : c)
          .setStyle(ButtonStyle.Primary)
      )
    ));
  }

  state.currentChoices = choices;
  const msg = await interaction.followUp({ embeds: [embed], components: rows });

  const timeout = setTimeout(async () => {
    client.activeGames.delete(gameKey);
    state.round++;
    await msg.edit({
      embeds: [new EmbedBuilder().setTitle('⏰ Czas minął!').setDescription(`Odpowiedź: **${question.answer}**`).setColor(0xFEE75C)],
      components: []
    }).catch(() => {});

    if (state.round > ROUNDS) {
      await endEmojiGuess(interaction, state);
    } else {
      client.activeGames.set(gameKey, state);
      await askEmojiQuestion(interaction, client, gameKey, state);
    }
  }, 20000);

  state.handleButton = async (btn) => {
    if (btn.user.id !== state.userId) return btn.reply({ content: '❌ To nie twoja gra!', ephemeral: true });
    clearTimeout(timeout);
    client.activeGames.delete(gameKey);

    const chosenIdx = parseInt(btn.customId.split('_')[1]);
    const chosen = choices[chosenIdx];
    const correct = chosen === question.answer;
    const elapsed = Date.now() - shownAt;
    const speedBonus = correct ? Math.max(0, Math.round((20000 - elapsed) / 200)) : 0;
    const points = correct ? 30 + speedBonus : 0;

    if (correct) state.score += points;

    const resultRows = rows.map(row => new ActionRowBuilder().addComponents(
      row.components.map(btn2 => {
        const idx2 = parseInt(btn2.data.custom_id.split('_')[1]);
        const c = choices[idx2];
        return new ButtonBuilder()
          .setCustomId(btn2.data.custom_id + '_done')
          .setLabel(btn2.data.label)
          .setStyle(c === question.answer ? ButtonStyle.Success : (c === chosen && !correct ? ButtonStyle.Danger : ButtonStyle.Secondary))
          .setDisabled(true);
      })
    ));

    await btn.update({
      embeds: [new EmbedBuilder()
        .setTitle(correct ? '✅ Dobrze!' : '❌ Błąd!')
        .setDescription(correct ? `**${question.answer}** — +${points} pkt (${speedBonus} bonus za szybkość)` : `Odpowiedź: **${question.answer}**`)
        .setColor(correct ? 0x57F287 : 0xED4245)],
      components: resultRows
    });

    state.round++;
    if (state.round > ROUNDS) {
      await endEmojiGuess(btn, state);
    } else {
      client.activeGames.set(gameKey, state);
      await askEmojiQuestion(btn, client, gameKey, state);
    }
  };

  client.activeGames.set(gameKey, state);
}

async function endEmojiGuess(interaction, state) {
  const embed = new EmbedBuilder()
    .setTitle('🎭 Koniec Zgadywania!')
    .addFields({ name: '🏆 Wynik końcowy', value: `**${state.score} punktów**` })
    .setColor(0xEB459E)
    .setTimestamp();
  await interaction.followUp({ embeds: [embed] });
}

module.exports = { startEmojiGuess };
