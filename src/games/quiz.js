const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const QUESTIONS_PER_GAME = 5;

function generateQuestion(level) {
  const ops = level <= 2 ? ['+', '-'] : level <= 4 ? ['+', '-', '*'] : ['+', '-', '*', '/'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;

  const max = level <= 2 ? 20 : level <= 4 ? 50 : 100;

  if (op === '+') { a = rand(1, max); b = rand(1, max); answer = a + b; }
  else if (op === '-') { a = rand(max / 2, max); b = rand(1, Math.floor(max / 2)); answer = a - b; }
  else if (op === '*') { a = rand(2, level <= 3 ? 9 : 15); b = rand(2, level <= 3 ? 9 : 12); answer = a * b; }
  else { b = rand(2, 12); answer = rand(2, 12); a = b * answer; } // division always clean

  // Generate 3 wrong answers
  const wrongs = new Set();
  while (wrongs.size < 3) {
    const delta = rand(-Math.max(5, Math.floor(answer * 0.3)), Math.max(5, Math.floor(answer * 0.3)));
    const w = answer + delta;
    if (w !== answer && w > 0) wrongs.add(w);
  }

  const choices = shuffle([answer, ...wrongs]);
  return { question: `${a} ${op} ${b}`, answer, choices };
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

async function startQuiz(interaction, client, gameKey) {
  const state = {
    userId: interaction.user.id,
    score: 0,
    streak: 0,
    questionIndex: 0,
    level: 1,
    handleButton: null,
  };

  client.activeGames.set(gameKey, state);

  await interaction.update({ components: [], embeds: [] });
  await askQuestion(interaction, client, gameKey, state);
}

async function askQuestion(interaction, client, gameKey, state) {
  const { question, answer, choices } = generateQuestion(state.level);
  state.currentAnswer = answer;
  state.currentChoices = choices;

  const diffLabel = state.level <= 2 ? '🟢 Łatwy' : state.level <= 4 ? '🟡 Średni' : '🔴 Trudny';
  const progressBar = '▓'.repeat(state.questionIndex) + '░'.repeat(QUESTIONS_PER_GAME - state.questionIndex);

  const embed = new EmbedBuilder()
    .setTitle(`🔢 Quiz Matematyczny — Pytanie ${state.questionIndex + 1}/${QUESTIONS_PER_GAME}`)
    .setDescription(`## \`${question} = ?\``)
    .addFields(
      { name: '📊 Postęp', value: `\`${progressBar}\``, inline: false },
      { name: '🏆 Punkty', value: `${state.score}`, inline: true },
      { name: '🔥 Seria', value: `${state.streak}`, inline: true },
      { name: '⚡ Poziom', value: diffLabel, inline: true },
    )
    .setColor(state.level <= 2 ? 0x57F287 : state.level <= 4 ? 0xFEE75C : 0xED4245)
    .setFooter({ text: `Masz 15 sekund!` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    choices.map((c, i) =>
      new ButtonBuilder()
        .setCustomId(`quiz_${i}`)
        .setLabel(`${NUM_EMOJI[i]} ${c}`)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const msg = await interaction.followUp({ embeds: [embed], components: [row] });

  const timeout = setTimeout(async () => {
    await handleTimeout(msg, interaction, client, gameKey, state, answer, choices);
  }, 15000);

  state.handleButton = async (btn) => {
    if (btn.user.id !== state.userId) {
      return btn.reply({ content: '❌ To nie twoja gra!', ephemeral: true });
    }
    clearTimeout(timeout);
    client.activeGames.delete(gameKey);

    const chosenIdx = parseInt(btn.customId.split('_')[1]);
    const chosen = choices[chosenIdx];
    const correct = chosen === answer;

    if (correct) {
      state.score += 10 + state.streak * 2 + (state.level - 1) * 5;
      state.streak++;
      if (state.streak % 3 === 0) state.level = Math.min(5, state.level + 1);
    } else {
      state.streak = 0;
    }

    // Show result buttons (colored)
    const resultRow = new ActionRowBuilder().addComponents(
      choices.map((c, i) => {
        const isCorrect = c === answer;
        const isChosen = i === chosenIdx;
        return new ButtonBuilder()
          .setCustomId(`result_${i}`)
          .setLabel(`${NUM_EMOJI[i]} ${c}`)
          .setStyle(isCorrect ? ButtonStyle.Success : (isChosen ? ButtonStyle.Danger : ButtonStyle.Secondary))
          .setDisabled(true);
      })
    );

    const resultEmbed = new EmbedBuilder()
      .setTitle(correct ? '✅ Poprawnie!' : '❌ Błąd!')
      .setDescription(correct
        ? `Świetnie! Odpowiedź: **${answer}**\n+${10 + (state.streak - 1) * 2 + (state.level - 1) * 5} pkt 🎉`
        : `Niestety! Poprawna odpowiedź to **${answer}**`)
      .setColor(correct ? 0x57F287 : 0xED4245);

    await btn.update({ embeds: [resultEmbed], components: [resultRow] });

    state.questionIndex++;
    if (state.questionIndex >= QUESTIONS_PER_GAME) {
      await endQuiz(btn, state);
    } else {
      client.activeGames.set(gameKey, state);
      await askQuestion(btn, client, gameKey, state);
    }
  };

  client.activeGames.set(gameKey, state);
}

async function handleTimeout(msg, interaction, client, gameKey, state, answer, choices) {
  client.activeGames.delete(gameKey);
  state.streak = 0;

  const resultRow = new ActionRowBuilder().addComponents(
    choices.map((c, i) =>
      new ButtonBuilder()
        .setCustomId(`to_${i}`)
        .setLabel(`${NUM_EMOJI[i]} ${c}`)
        .setStyle(c === answer ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(true)
    )
  );

  await msg.edit({
    embeds: [new EmbedBuilder().setTitle('⏰ Czas minął!').setDescription(`Poprawna odpowiedź: **${answer}**`).setColor(0xFEE75C)],
    components: [resultRow]
  }).catch(() => {});

  state.questionIndex++;
  if (state.questionIndex >= QUESTIONS_PER_GAME) {
    await endQuiz(interaction, state);
  } else {
    client.activeGames.set(gameKey, state);
    await askQuestion(interaction, client, gameKey, state);
  }
}

async function endQuiz(interaction, state) {
  const rank = state.score >= 200 ? '🏆 Mistrz!' : state.score >= 100 ? '🥇 Świetnie!' : state.score >= 50 ? '🥈 Nieźle!' : '🥉 Spróbuj jeszcze raz!';

  const embed = new EmbedBuilder()
    .setTitle('🎯 Koniec Quizu!')
    .setDescription(`**${rank}**`)
    .addFields(
      { name: '🏆 Wynik końcowy', value: `**${state.score} punktów**`, inline: true },
      { name: '⚡ Max poziom', value: `${state.level}`, inline: true },
    )
    .setColor(0x5865F2)
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });
}

module.exports = { startQuiz };
