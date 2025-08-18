const API_URL = 'ask.php';
const micBtn = document.getElementById('mic');
const overlay = document.getElementById('overlay');
const ovText = document.getElementById('ovText');
const ovSub = document.getElementById('ovSub');
const messagesEl = document.getElementById('messages');
const messagesWrap = document.getElementById('messagesWrap');

let audioContextUnlocked = false; // Variable de estado para el audio

// Función para desbloquear el contexto de audio en iOS
function unlockAudio() {
  if (!audioContextUnlocked) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    audioContextUnlocked = true;
  }
}

function bubble(text, who = 'bot') {
  const el = document.createElement('div');
  el.className = `bubble ${who}`;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showOverlay(mode, main = '', sub = '') {
  overlay.classList.add('show');
  if (main) ovText.textContent = main;
  if (sub) ovSub.textContent = sub;
  document.getElementById('ovWave').style.visibility = (mode === 'listen') ? 'visible' : 'hidden';
  messagesWrap.classList.add('hidden');
}

function hideOverlay() {
  overlay.classList.remove('show');
  messagesWrap.classList.remove('hidden');
}

async function askBackend(userText) {
  const payload = { userText };
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  return (data && data.text) ? data.text : "Sorry, I didn’t catch that.";
}

function speakWithProgress(text) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";

  showOverlay('speak', '', 'Speaking…');
  ovText.textContent = '';

  let i = 0;
  const step = Math.ceil(text.length / 40);
  const timer = setInterval(() => {
    i = Math.min(i + step, text.length);
    ovText.textContent = text.slice(0, i);
    if (i >= text.length) clearInterval(timer);
  }, 60);

  u.onend = () => {
    clearInterval(timer);
    ovText.textContent = text;
    setTimeout(hideOverlay, 400);
  };

  window.speechSynthesis.speak(u);
}

async function handleUserTurn(userText) {
  bubble(userText, 'user');
  showOverlay('speak', 'Thinking…', 'Contacting assistant');
  let reply = "Sorry, something went wrong.";
  try {
    reply = await askBackend(userText);
  } catch (e) {
    console.error(e);
  }
  bubble(reply, 'bot');
  speakWithProgress(reply);
}

document.querySelectorAll('.chip').forEach(ch => {
  ch.onclick = () => {
    unlockAudio(); // Desbloquea el audio al tocar un chip
    handleUserTurn(ch.dataset.q);
  };
});

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog;
function initRecog() {
  recog = new SR();
  recog.lang = "en-US";
  recog.interimResults = true;
  recog.maxAlternatives = 1;

  recog.onstart = () => showOverlay('listen', "I'm listening…", "Speak now");
  recog.onerror = (e) => showOverlay('listen', "Mic error", e.error || "Try again");
  recog.onend = () => setTimeout(hideOverlay, 200);

  let finalText = '';
  recog.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const tr = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += tr + ' ';
      else interim += tr;
    }
    const live = (finalText + interim).trim();
    if (live) showOverlay('listen', live, interim ? 'Listening…' : 'Processing…');

    if (finalText.trim()) {
      hideOverlay();
      handleUserTurn(finalText.trim());
      finalText = '';
    }
  };
}

micBtn.onclick = () => {
  unlockAudio(); // Desbloquea el audio al tocar el micrófono
  if (!recog) initRecog();
  try {
    recog.start();
  } catch (e) {
    console.error(e);
  }
};

window.onload = () => {
  showOverlay('listen', "I’m ready, ask me anything!", "Tap the mic to start");
};