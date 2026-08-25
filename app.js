const DEFAULT_WORDS = [
  "disconnect","disobey","nondairy","nonremovable","nonstick",
  "rearrange","refreeze","uncooked","unidentified","untangle"
];

const DEFAULT_PLAYERS = {
  p1: { name: "Player 1", words: [...DEFAULT_WORDS] },
  p2: { name: "Player 2", words: [] }
};

const els = {
  score: document.getElementById("score"),
  streak: document.getElementById("streak"),
  correct: document.getElementById("correct"),
  best: document.getElementById("best"),
  mode: document.getElementById("modeSelect"),
  game: document.getElementById("gameCard"),
  feedback: document.getElementById("feedback"),
  next: document.getElementById("nextBtn"),
  parentBtn: document.getElementById("parentBtn"),
  dialog: document.getElementById("parentDialog"),
  wordText: document.getElementById("wordText"),
  loadWords: document.getElementById("loadWordsBtn"),
  resetScores: document.getElementById("resetScoresBtn"),
  uploadMessage: document.getElementById("uploadMessage"),
  loadedCount: document.getElementById("loadedCount"),
  playerNameInput: document.getElementById("playerNameInput"),
  player1Btn: document.getElementById("player1Btn"),
  player2Btn: document.getElementById("player2Btn"),
  settingsP1: document.getElementById("settingsP1"),
  settingsP2: document.getElementById("settingsP2"),
  playerNameDisplay: document.getElementById("playerNameDisplay"),
  roundProgress: document.getElementById("roundProgress"),
  roundDialog: document.getElementById("roundDialog"),
  roundTitle: document.getElementById("roundTitle"),
  roundSummary: document.getElementById("roundSummary"),
  missedSummary: document.getElementById("missedSummary"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  practiceMissedBtn: document.getElementById("practiceMissedBtn")
};

function blankProgress() {
  return {
    score: 0, streak: 0, correct: 0, best: 0,
    missed: {}, attempts: {}, correctByWord: {},
    roundWords: [], roundIndex: 0, roundMissed: []
  };
}

function loadState() {
  const saved = JSON.parse(localStorage.getItem("spellingAdventureState") || "null");
  if (saved && saved.players) return saved;

  return {
    activePlayer: "p1",
    settingsPlayer: "p1",
    practiceMissedOnly: false,
    players: {
      p1: {...DEFAULT_PLAYERS.p1, ...blankProgress()},
      p2: {...DEFAULT_PLAYERS.p2, ...blankProgress()}
    }
  };
}

let state = loadState();
let round = {};
let selectedChoice = null;

function player() {
  return state.players[state.activePlayer];
}

function persist() {
  localStorage.setItem("spellingAdventureState", JSON.stringify(state));
}

function normalizeWords(raw) {
  const pieces = raw.replace(/\r/g, "\n").split(/[\n,;]+/);
  const cleaned = pieces
    .map(w => w.trim().toLowerCase())
    .filter(Boolean)
    .filter(w => /^[a-zA-Z' -]+$/.test(w));
  return [...new Set(cleaned)];
}

function updatePlayerButtons() {
  els.player1Btn.textContent = state.players.p1.name || "Player 1";
  els.player2Btn.textContent = state.players.p2.name || "Player 2";
  els.player1Btn.classList.toggle("active", state.activePlayer === "p1");
  els.player2Btn.classList.toggle("active", state.activePlayer === "p2");
  els.playerNameDisplay.textContent = player().name || "Player";
}

function updateStats() {
  const p = player();
  els.score.textContent = p.score;
  els.streak.textContent = p.streak;
  els.correct.textContent = p.correct;
  els.best.textContent = p.best;
  const total = p.roundWords.length || p.words.length || 0;
  const shownIndex = Math.min((p.roundIndex || 0) + 1, Math.max(total, 1));
  els.roundProgress.textContent = total ? `Word ${shownIndex} of ${total}` : "No words loaded";
  updatePlayerButtons();
}

function resetPlayerProgress(key) {
  const p = state.players[key];
  const name = p.name;
  const words = [...p.words];
  state.players[key] = {...blankProgress(), name, words};
  persist();
}

function prepareRound(force=false) {
  const p = player();
  if (!p.words.length) {
    round = {word: "", checked: false, guessed: new Set(), wrong: 0};
    renderNoWords();
    return;
  }

  if (force || !p.roundWords.length || p.roundIndex >= p.roundWords.length) {
    let pool = state.practiceMissedOnly ? [...new Set(p.roundMissed)] : [...p.words];
    if (!pool.length) pool = [...p.words];
    p.roundWords = pool.sort(() => Math.random() - .5);
    p.roundIndex = 0;
    p.roundMissed = [];
    persist();
  }
  newRound();
}

function currentWord() {
  const p = player();
  return p.roundWords[p.roundIndex] || p.words[0] || "";
}

function newRound() {
  round = { word: currentWord(), checked: false, guessed: new Set(), wrong: 0 };
  selectedChoice = null;
  els.feedback.className = "feedback hidden";
  els.feedback.textContent = "";
  els.next.classList.add("hidden");
  updateStats();
  renderGame();

  if (els.mode.value === "hear") {
    window.setTimeout(speakWord, 250);
  }
}

function nextWord() {
  const p = player();
  p.roundIndex += 1;
  persist();

  if (p.roundIndex >= p.roundWords.length) {
    showRoundComplete();
  } else {
    newRound();
  }
}

function switchPlayer(key) {
  state.activePlayer = key;
  state.practiceMissedOnly = false;
  persist();
  prepareRound(false);
}

function showRoundComplete() {
  const p = player();
  const uniqueMissed = [...new Set(p.roundMissed)];
  els.roundTitle.textContent = uniqueMissed.length ? "🎉 Round Complete!" : "🏆 Perfect Round!";
  els.roundSummary.textContent = `${p.name} finished ${p.roundWords.length} words. Score: ${p.score}. Best streak: ${p.best}.`;

  if (uniqueMissed.length) {
    els.missedSummary.innerHTML = `<strong>Practice again:</strong><br>${uniqueMissed.map(escapeHtml).join(", ")}`;
    els.practiceMissedBtn.classList.remove("hidden");
  } else {
    els.missedSummary.innerHTML = `<strong>Every word was correct!</strong>`;
    els.practiceMissedBtn.classList.add("hidden");
    celebrateWithBalloons();
  }
  els.roundDialog.showModal();
}

function renderNoWords() {
  updateStats();
  els.game.innerHTML = `
    <div class="prompt">No spelling words are loaded for ${escapeHtml(player().name)}.</div>
    <p>Open Settings to add this player's word list.</p>`;
  els.next.classList.add("hidden");
}

function shuffled(word) {
  if (word.length < 2) return word;
  for (let tries = 0; tries < 50; tries++) {
    const arr = [...word];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const value = arr.join("");
    if (value !== word) return value;
  }
  return [...word].reverse().join("");
}

function masked(word) {
  if (word.length <= 2) return "_ ".repeat(word.length).trim();
  const visible = new Set([0, word.length - 1]);
  const target = Math.max(2, Math.round(word.length * .35));
  const internal = Array.from({length: word.length - 2}, (_, i) => i + 1)
    .sort(() => Math.random() - .5);
  internal.slice(0, Math.max(0, target - 2)).forEach(i => visible.add(i));
  return [...word].map((ch, i) => visible.has(i) ? ch : "_").join(" ");
}

function makeMisspellings(word) {
  const set = new Set();
  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] !== word[i+1]) {
      const a = [...word];
      [a[i], a[i+1]] = [a[i+1], a[i]];
      set.add(a.join(""));
    }
  }
  for (let i = 1; i < word.length - 1; i++) {
    set.add(word.slice(0,i) + word.slice(i+1));
    set.add(word.slice(0,i) + word[i] + word.slice(i));
  }
  const vowels = "aeiou";
  [...word].forEach((ch, i) => {
    if (vowels.includes(ch)) {
      [...vowels].filter(v => v !== ch).forEach(v => set.add(word.slice(0,i) + v + word.slice(i+1)));
    }
  });
  set.delete(word);
  const choices = [...set].filter(v => v && !player().words.includes(v));
  while (choices.length < 3) {
    const i = Math.floor(Math.random() * word.length);
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    let r = alphabet[Math.floor(Math.random() * alphabet.length)];
    if (r === word[i]) r = "x";
    const v = word.slice(0,i) + r + word.slice(i+1);
    if (v !== word && !choices.includes(v) && !player().words.includes(v)) choices.push(v);
  }
  return choices.sort(() => Math.random() - .5).slice(0,3);
}

function speakWord() {
  if (!round.word || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(round.word);
  utterance.rate = .78;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function playSound(fileName) {
  try {
    const audio = new Audio(fileName);
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}
function playCorrectSound() { playSound("correct.wav"); }
function playWrongSound() { playSound("wrong.wav"); }

function celebrateWithBalloons() {
  const layer = document.createElement("div");
  layer.className = "balloon-layer";
  layer.setAttribute("aria-hidden", "true");
  const balloons = ["🎈","🎈","🎈","🎉","🎈","⭐","🎈","🎊","🎈","⭐","🎈","🎉"];
  balloons.forEach(symbol => {
    const item = document.createElement("span");
    item.className = "celebration-balloon";
    item.textContent = symbol;
    item.style.left = `${4 + Math.random() * 90}%`;
    item.style.animationDelay = `${Math.random() * 0.35}s`;
    item.style.animationDuration = `${2.2 + Math.random() * 1.0}s`;
    item.style.fontSize = `${1.7 + Math.random() * 1.3}rem`;
    layer.appendChild(item);
  });
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 3800);
}

const CORRECT_MESSAGES = [
  "🎉 You got it! +10 points",
  "⭐ Great spelling! +10 points",
  "👏 Nice work! +10 points",
  "🏆 Excellent! +10 points",
  "✨ Correct! +10 points"
];
const WRONG_MESSAGES = [
  word => `💡 Almost! The correct spelling is ${word}.`,
  word => `🔁 Good try! Let's remember ${word}.`,
  word => `💪 Keep going! The correct spelling is ${word}.`
];

function recordAnswer(isCorrect) {
  if (round.checked) return;
  round.checked = true;
  const p = player();
  const word = round.word;
  p.attempts[word] = (p.attempts[word] || 0) + 1;

  if (isCorrect) {
    p.score += 10;
    p.streak += 1;
    p.best = Math.max(p.best, p.streak);
    p.correct += 1;
    p.correctByWord[word] = (p.correctByWord[word] || 0) + 1;
    showFeedback(CORRECT_MESSAGES[Math.floor(Math.random() * CORRECT_MESSAGES.length)], true);
    playCorrectSound();
    celebrateWithBalloons();
  } else {
    p.streak = 0;
    p.missed[word] = (p.missed[word] || 0) + 1;
    p.roundMissed.push(word);
    const msg = WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)];
    showFeedback(msg(word), false);
    playWrongSound();
  }
  persist();
  updateStats();
  disableRoundInputs();
  els.next.classList.remove("hidden");
}

function showFeedback(message, good) {
  els.feedback.textContent = message;
  els.feedback.className = `feedback ${good ? "good" : "bad"}`;
}

function disableRoundInputs() {
  els.game.querySelectorAll("input, button").forEach(el => el.disabled = true);
}

function checkTyped(input) {
  const value = input.value.trim().toLowerCase();
  if (!value) {
    showFeedback("Type an answer first.", false);
    return;
  }
  recordAnswer(value === round.word);
}

function renderGame() {
  if (!round.word) return renderNoWords();
  const mode = els.mode.value;
  if (mode === "hear") renderHear();
  else if (mode === "pick") renderPick();
  else if (mode === "unscramble") renderTyped("Unscramble the letters.", shuffled(round.word), "Type the correctly spelled word...");
  else if (mode === "missing") renderTyped("Fill in the missing letters.", masked(round.word), "Type the full word...");
  else renderHangman();
}

function renderHear() {
  els.game.innerHTML = `
    <div class="prompt">Listen, then spell the word.</div>
    <button class="secondary full listen-btn" type="button">🔊 Hear the Word Again</button>
    <input class="answer-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Type the word here..." />
    <button class="primary full check-btn" type="button">Check Answer</button>`;
  const input = els.game.querySelector(".answer-input");
  els.game.querySelector(".listen-btn").onclick = speakWord;
  els.game.querySelector(".check-btn").onclick = () => checkTyped(input);
  input.addEventListener("keydown", e => { if (e.key === "Enter") checkTyped(input); });
}

function renderTyped(prompt, display, placeholder) {
  els.game.innerHTML = `
    <div class="prompt">${prompt}</div>
    <div class="big-word">${escapeHtml(display)}</div>
    <input class="answer-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${placeholder}" />
    <button class="primary full check-btn" type="button">Check Answer</button>`;
  const input = els.game.querySelector(".answer-input");
  els.game.querySelector(".check-btn").onclick = () => checkTyped(input);
  input.addEventListener("keydown", e => { if (e.key === "Enter") checkTyped(input); });
}

function renderPick() {
  const choices = [round.word, ...makeMisspellings(round.word)].sort(() => Math.random() - .5);
  els.game.innerHTML = `<div class="prompt">Choose the correctly spelled word.</div>
    <div id="choices"></div>
    <button class="primary full check-btn" type="button">Check Answer</button>`;
  const box = els.game.querySelector("#choices");
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.textContent = choice;
    btn.onclick = () => {
      selectedChoice = choice;
      box.querySelectorAll(".choice").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    };
    box.appendChild(btn);
  });
  els.game.querySelector(".check-btn").onclick = () => {
    if (!selectedChoice) return showFeedback("Choose an answer first.", false);
    recordAnswer(selectedChoice === round.word);
  };
}

function hangmanSvg(wrong) {
  const parts = [
    wrong >= 1 ? '<circle cx="100" cy="61" r="15" class="person-part" />' : '',
    wrong >= 2 ? '<line x1="100" y1="76" x2="100" y2="125" class="person-part" />' : '',
    wrong >= 3 ? '<line x1="100" y1="88" x2="75" y2="108" class="person-part" />' : '',
    wrong >= 4 ? '<line x1="100" y1="88" x2="125" y2="108" class="person-part" />' : '',
    wrong >= 5 ? '<line x1="100" y1="125" x2="78" y2="153" class="person-part" />' : '',
    wrong >= 6 ? '<line x1="100" y1="125" x2="122" y2="153" class="person-part" />' : ''
  ].join("");
  return `
    <svg class="hangman-svg" viewBox="0 0 190 175" role="img" aria-label="Hangman with ${wrong} of 6 wrong guesses">
      <line x1="20" y1="163" x2="165" y2="163" class="gallows" />
      <line x1="48" y1="163" x2="48" y2="20" class="gallows" />
      <line x1="48" y1="20" x2="100" y2="20" class="gallows" />
      <line x1="100" y1="20" x2="100" y2="46" class="gallows" />
      ${parts}
    </svg>`;
}

function renderHangman() {
  const finished = round.checked;
  const lost = finished && round.wrong >= 6;
  const shown = [...round.word].map(ch => {
    if (ch === " " || ch === "-") return ch;
    if (lost || round.guessed.has(ch)) return ch.toUpperCase();
    return "_";
  }).join(" ");

  els.game.innerHTML = `
    <div class="prompt">Guess one letter at a time. You get 6 wrong guesses.</div>
    <div class="hangman-stage">${hangmanSvg(round.wrong)}</div>
    <div class="wrong-count">${round.wrong} of 6 wrong guesses</div>
    <div class="hangman-word">${escapeHtml(shown)}</div>
    <div class="letter-entry">
      <input id="letterInput" maxlength="1" inputmode="text" autocomplete="off"
             autocapitalize="characters" aria-label="Guess a letter" ${finished ? "disabled" : ""} />
      <button class="primary" id="guessBtn" type="button" ${finished ? "disabled" : ""}>Guess</button>
    </div>
    <div class="guessed">Guessed: ${[...round.guessed].map(x => x.toUpperCase()).join(", ") || "None"}</div>`;

  if (finished) return;

  const input = els.game.querySelector("#letterInput");
  const guessBtn = els.game.querySelector("#guessBtn");
  const makeGuess = () => {
    const letter = input.value.trim().toLowerCase();

    if (!/^[a-z]$/.test(letter)) {
      showFeedback("Enter one letter.", false);
      input.value = "";
      input.focus();
      return;
    }
    if (round.guessed.has(letter)) {
      input.value = "";
      showFeedback("You already guessed that letter. It does not count against you.", false);
      input.focus();
      return;
    }

    round.guessed.add(letter);
    if (!round.word.includes(letter)) round.wrong += 1;

    const lettersNeeded = [...new Set(round.word.replace(/[^a-z]/g, ""))];
    const won = lettersNeeded.every(ch => round.guessed.has(ch));

    if (won) {
      recordAnswer(true);
      renderHangman();
      return;
    }
    if (round.wrong >= 6) {
      recordAnswer(false);
      renderHangman();
      return;
    }

    els.feedback.className = "feedback hidden";
    els.feedback.textContent = "";
    renderHangman();
  };

  guessBtn.onclick = makeGuess;
  input.addEventListener("keydown", e => { if (e.key === "Enter") makeGuess(); });
  input.focus();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function openSettingsFor(key) {
  state.settingsPlayer = key;
  const p = state.players[key];
  els.playerNameInput.value = p.name;
  els.wordText.value = p.words.join("\n");
  els.loadedCount.textContent = p.words.length;
  els.uploadMessage.textContent = "";
  els.settingsP1.classList.toggle("active", key === "p1");
  els.settingsP2.classList.toggle("active", key === "p2");
}

els.parentBtn.onclick = () => {
  openSettingsFor(state.activePlayer);
  els.dialog.showModal();
};

els.settingsP1.onclick = () => openSettingsFor("p1");
els.settingsP2.onclick = () => openSettingsFor("p2");

els.loadWords.onclick = () => {
  const key = state.settingsPlayer;
  const words = normalizeWords(els.wordText.value);
  const name = els.playerNameInput.value.trim() || (key === "p1" ? "Player 1" : "Player 2");

  if (!words.length) {
    els.uploadMessage.textContent = "Please enter at least one word.";
    return;
  }

  state.players[key].name = name;
  state.players[key].words = words;
  resetPlayerProgress(key);
  state.players[key].name = name;
  state.players[key].words = words;
  persist();

  els.loadedCount.textContent = words.length;
  els.uploadMessage.textContent = `${name}'s list saved: ${words.length} words.`;
  updatePlayerButtons();

  if (state.activePlayer === key) prepareRound(true);
};

els.resetScores.onclick = () => {
  const key = state.settingsPlayer;
  resetPlayerProgress(key);
  els.uploadMessage.textContent = `${state.players[key].name}'s score and progress were reset.`;
  if (state.activePlayer === key) prepareRound(true);
};

els.player1Btn.onclick = () => switchPlayer("p1");
els.player2Btn.onclick = () => switchPlayer("p2");

els.mode.addEventListener("change", () => {
  newRound();
  if (els.mode.value === "hear") window.setTimeout(speakWord, 250);
});

els.next.onclick = nextWord;

els.playAgainBtn.onclick = () => {
  els.roundDialog.close();
  state.practiceMissedOnly = false;
  player().roundWords = [];
  player().roundIndex = 0;
  persist();
  prepareRound(true);
};

els.practiceMissedBtn.onclick = () => {
  els.roundDialog.close();
  state.practiceMissedOnly = true;
  const p = player();
  const missed = [...new Set(p.roundMissed)];
  p.roundWords = missed;
  p.roundIndex = 0;
  p.roundMissed = [];
  persist();
  newRound();
};

updateStats();
prepareRound(false);
