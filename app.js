const DEFAULT_WORDS = [
  "disconnect","disobey","nondairy","nonremovable","nonstick",
  "rearrange","refreeze","uncooked","unidentified","untangle"
];

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
  wordsToggle: document.getElementById("wordsToggle"),
  wordListPanel: document.getElementById("wordListPanel")
};

let state = loadState();
let round = {};
let selectedChoice = null;

function loadState() {
  const savedWords = JSON.parse(localStorage.getItem("spellingWords") || "null");
  return {
    words: Array.isArray(savedWords) && savedWords.length ? savedWords : [...DEFAULT_WORDS],
    score: Number(localStorage.getItem("score") || 0),
    streak: Number(localStorage.getItem("streak") || 0),
    correct: Number(localStorage.getItem("correct") || 0),
    best: Number(localStorage.getItem("best") || 0),
    missed: JSON.parse(localStorage.getItem("missed") || "{}"),
    attempts: JSON.parse(localStorage.getItem("attempts") || "{}"),
    correctByWord: JSON.parse(localStorage.getItem("correctByWord") || "{}")
  };
}

function persist() {
  localStorage.setItem("spellingWords", JSON.stringify(state.words));
  localStorage.setItem("score", state.score);
  localStorage.setItem("streak", state.streak);
  localStorage.setItem("correct", state.correct);
  localStorage.setItem("best", state.best);
  localStorage.setItem("missed", JSON.stringify(state.missed));
  localStorage.setItem("attempts", JSON.stringify(state.attempts));
  localStorage.setItem("correctByWord", JSON.stringify(state.correctByWord));
}

function resetScores() {
  state.score = state.streak = state.correct = state.best = 0;
  state.missed = {};
  state.attempts = {};
  state.correctByWord = {};
  persist();
  updateStats();
  renderWordList();
  newRound();
}

function normalizeWords(raw) {
  const pieces = raw.replace(/\r/g, "\n").split(/[\n,;]+/);
  const cleaned = pieces
    .map(w => w.trim().toLowerCase())
    .filter(Boolean)
    .filter(w => /^[a-zA-Z' -]+$/.test(w));
  return [...new Set(cleaned)];
}


function chooseWord() {
  if (state.words.length === 1) return state.words[0];
  if (!round.word) return state.words[Math.floor(Math.random() * state.words.length)];
  const candidates = state.words.filter(w => w !== round.word);
  const weighted = [];
  candidates.forEach(w => {
    const weight = 1 + Math.min(state.missed[w] || 0, 4) * 2;
    for (let i = 0; i < weight; i++) weighted.push(w);
  });
  return weighted[Math.floor(Math.random() * weighted.length)];
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
  const choices = [...set].filter(v => v && !state.words.includes(v));
  while (choices.length < 3) {
    const i = Math.floor(Math.random() * word.length);
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    let r = alphabet[Math.floor(Math.random() * alphabet.length)];
    if (r === word[i]) r = "x";
    const v = word.slice(0,i) + r + word.slice(i+1);
    if (v !== word && !choices.includes(v) && !state.words.includes(v)) choices.push(v);
  }
  return choices.sort(() => Math.random() - .5).slice(0,3);
}

function speakWord() {
  if (!("speechSynthesis" in window)) {
    showFeedback("Speech isn't available in this browser.", false);
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(round.word);
  utterance.rate = .78;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function playCorrectSound() {
  tone([660, 880, 1040], .11);
}
function playWrongSound() {
  tone([180, 130], .22);
}
function tone(freqs, duration) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.value = .055;
      osc.connect(gain); gain.connect(ctx.destination);
      const start = ctx.currentTime + index * duration;
      osc.start(start); osc.stop(start + duration);
    });
  } catch {}
}

function updateStats() {
  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
  els.correct.textContent = state.correct;
  els.best.textContent = state.best;
  els.loadedCount.textContent = state.words.length;
}

function recordAnswer(isCorrect) {
  if (round.checked) return;
  round.checked = true;
  const word = round.word;
  state.attempts[word] = (state.attempts[word] || 0) + 1;

  if (isCorrect) {
    state.score += 10;
    state.streak += 1;
    state.best = Math.max(state.best, state.streak);
    state.correct += 1;
    state.correctByWord[word] = (state.correctByWord[word] || 0) + 1;
    showFeedback("🎉 Correct! +10 points", true);
    playCorrectSound();
  } else {
    state.streak = 0;
    state.missed[word] = (state.missed[word] || 0) + 1;
    showFeedback(`💡 Almost! The correct spelling is ${word}.`, false);
    playWrongSound();
  }
  persist();
  updateStats();
  renderWordList();
  disableRoundInputs();
  els.next.classList.remove("hidden");
}

function showFeedback(message, good) {
  els.feedback.textContent = message;
  els.feedback.className = `feedback ${good ? "good" : "bad"}`;
}

function disableRoundInputs() {
  els.game.querySelectorAll("input, button.choice, button.check-btn, button.listen-btn").forEach(el => el.disabled = true);
}

function checkTyped(input) {
  const value = input.value.trim().toLowerCase();
  if (!value) {
    showFeedback("Type an answer first.", false);
    return;
  }
  recordAnswer(value === round.word);
}

function newRound() {
  round = { word: chooseWord(), checked: false, guessed: new Set(), wrong: 0 };
  selectedChoice = null;
  els.feedback.className = "feedback hidden";
  els.feedback.textContent = "";
  els.next.classList.add("hidden");
  renderGame();
}

function renderGame() {
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
    <button class="secondary full listen-btn" type="button">🔊 Hear the Word</button>
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

function hangmanArt(wrong) {
  const head = wrong >= 1 ? "O" : " ";
  const body = wrong >= 2 ? "|" : " ";
  const leftArm = wrong >= 3 ? "/" : " ";
  const rightArm = wrong >= 4 ? "\\" : " ";
  const leftLeg = wrong >= 5 ? "/" : " ";
  const rightLeg = wrong >= 6 ? "\\" : " ";
  return ` +---+
 |   |
 ${head}   |
${leftArm}${body}${rightArm}  |
${leftLeg} ${rightLeg}  |
     |
=======`;
}

function renderHangman() {
  const shown = [...round.word].map(ch => ch === " " || ch === "-" ? ch : (round.guessed.has(ch) ? ch.toUpperCase() : "_")).join(" ");
  els.game.innerHTML = `
    <div class="prompt">Guess one letter at a time. You get 6 wrong guesses.</div>
    <div class="hangman-art">${escapeHtml(hangmanArt(round.wrong))}</div>
    <div class="hangman-word">${escapeHtml(shown)}</div>
    <div class="letter-entry">
      <input id="letterInput" maxlength="1" inputmode="text" autocomplete="off" autocapitalize="characters" aria-label="Guess a letter" />
      <button class="primary" id="guessBtn" type="button">Guess</button>
    </div>
    <div class="guessed">Guessed: ${[...round.guessed].map(x => x.toUpperCase()).join(", ") || "None"}</div>`;
  const input = els.game.querySelector("#letterInput");
  const guessBtn = els.game.querySelector("#guessBtn");
  const makeGuess = () => {
    const letter = input.value.trim().toLowerCase();
    if (!/^[a-z]$/.test(letter)) return showFeedback("Enter one letter.", false);
    if (round.guessed.has(letter)) {
      input.value = "";
      showFeedback("You already guessed that letter. It does not count against you.", false);
      return;
    }
    round.guessed.add(letter);
    if (!round.word.includes(letter)) round.wrong += 1;
    const lettersNeeded = [...new Set(round.word.replace(/[^a-z]/g, ""))];
    const won = lettersNeeded.every(ch => round.guessed.has(ch));
    if (won) return recordAnswer(true);
    if (round.wrong >= 6) return recordAnswer(false);
    els.feedback.className = "feedback hidden";
    renderHangman();
  };
  guessBtn.onclick = makeGuess;
  input.addEventListener("keydown", e => { if (e.key === "Enter") makeGuess(); });
  input.focus();
}

function renderWordList() {
  els.wordListPanel.innerHTML = "";
  state.words.forEach(word => {
    const attempts = state.attempts[word] || 0;
    const misses = state.missed[word] || 0;
    const correct = state.correctByWord[word] || 0;
    let icon = "⚪", label = "Not practiced yet";
    if (misses > 0) { icon = "🔁"; label = "Practice again"; }
    else if (attempts > 0 && correct > 0) { icon = "✅"; label = "Correct"; }
    const row = document.createElement("div");
    row.className = "word-row";
    row.textContent = `${icon} ${word} — ${label}`;
    els.wordListPanel.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

els.parentBtn.onclick = () => {
  els.wordText.value = state.words.join("\n");
  els.uploadMessage.textContent = "";
  els.dialog.showModal();
};

els.loadWords.onclick = () => {
  const words = normalizeWords(els.wordText.value);
  if (!words.length) {
    els.uploadMessage.textContent = "Please enter or upload at least one word.";
    return;
  }
  state.words = words;
  resetScores();
  persist();
  els.uploadMessage.textContent = `New spelling list loaded: ${words.length} words.`;
};

els.resetScores.onclick = () => {
  resetScores();
  els.uploadMessage.textContent = "Scores reset.";
};

els.mode.addEventListener("change", newRound);
els.next.onclick = newRound;

els.wordsToggle.onclick = () => {
  const hidden = els.wordListPanel.classList.toggle("hidden");
  els.wordsToggle.textContent = hidden ? "📚 Show this week's words" : "📚 Hide this week's words";
};

updateStats();
renderWordList();
newRound();
