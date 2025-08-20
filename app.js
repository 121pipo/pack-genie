// --- 1. CONFIGURACIÓN INICIAL Y SELECTORES ---
const API_URL = 'ask.php';

// Contenedores de las pantallas
const screens = document.querySelectorAll('.screen');
const introScreen = document.getElementById('introScreen');
const homeScreen = document.getElementById('homeScreen');
const chatScreen = document.getElementById('chatScreen');
const closingScreen = document.getElementById('closingScreen');

// Elementos de la pantalla HOME
const promptText = document.getElementById('promptText');
const promptSubText = document.getElementById('promptSubText');
const wave = document.getElementById('wave');
const micBtn = document.getElementById('mic');

// Elementos del CHAT
const messagesEl = document.getElementById('messages');

// Botones de Navegación
const talkToGenieBtn = document.getElementById('talkToGenieBtn');
const doneBtnIntro = document.getElementById('doneBtnIntro');
const seeConversationBtn = document.getElementById('seeConversationBtn');
const endConversationBtn = document.getElementById('endConversationBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const askAnotherQuestionBtn = document.getElementById('askAnotherQuestionBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadBtnClosing = document.getElementById('downloadBtnClosing');

// Variables de estado
let audioContextUnlocked = false;
let englishVoice;
let isConversationActive = false; // Controla el modo de escucha continua

// --- 2. MANEJO DE PANTALLAS Y ESTADOS ---
function showScreen(screenId) {
  screens.forEach(screen => screen.classList.add('hidden'));
  const activeScreen = document.getElementById(screenId);
  if (activeScreen) {
    activeScreen.classList.remove('hidden');
  } else {
    console.error("Screen not found:", screenId);
  }
}

function setHomePrompt(mode, mainText, subText = '') {
  promptText.textContent = mainText;
  promptSubText.textContent = subText;
  wave.style.visibility = (mode === 'listen' || mode === 'speak') ? 'visible' : 'hidden';
}

// --- 3. LÓGICA DE AUDIO Y VOZ ---
function unlockAudio() {
  if (!audioContextUnlocked) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    audioContextUnlocked = true;
  }
}

function loadAndSetEnglishVoice() {
  const voices = window.speechSynthesis.getVoices();
  englishVoice = voices.find(voice => voice.lang === 'en-US') || voices.find(voice => voice.lang.startsWith('en-'));
}

function speakWithProgress(text) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  if (englishVoice) u.voice = englishVoice;

  setHomePrompt('speak', text, 'Speaking...');

  // Al terminar de hablar, vuelve a escuchar automáticamente.
  u.onend = () => {
    startListening();
  };

  window.speechSynthesis.speak(u);
}

// --- 4. LÓGICA PRINCIPAL DE LA APP ---
function bubble(text, who = 'bot') {
  const el = document.createElement('div');
  el.className = `bubble ${who}`;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function askBackend(userText) {
  setHomePrompt('thinking', 'Thinking...', '');
  const payload = { userText };
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    return (data && data.text) ? data.text : "Sorry, I didn't catch that.";
  } catch (e) {
    console.error(e);
    return "I'm having a little trouble connecting right now.";
  }
}

async function handleUserTurn(userText) {
  bubble(userText, 'user');
  const reply = await askBackend(userText);
  bubble(reply, 'bot');
  speakWithProgress(reply);
}

// NUEVO: Función para iniciar la conversación con un saludo del bot.
async function startWithGreeting() {
    const initialPrompt = "Hello, give me a short and friendly welcome message.";
    const reply = await askBackend(initialPrompt);
    bubble(reply, 'bot');
    speakWithProgress(reply);
}


// --- 5. RECONOCIMIENTO DE VOZ ---
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog;

// Función auxiliar para iniciar la escucha
function startListening() {
    if (!isConversationActive) return; // No escucha si el modo conversacional no está activo
    if (!recog) initRecog();
    try {
        recog.start();
    } catch(e) {
        // A veces el microfono no está listo, lo reintentamos.
        setTimeout(() => {
            try { recog.start(); } catch(e) { console.error(e); }
        }, 250);
    }
}

function initRecog() {
  if (!SR) {
    alert("Speech Recognition is not supported in this browser.");
    return;
  }
  recog = new SR();
  recog.lang = "en-US";
  recog.interimResults = true;
  recog.onstart = () => setHomePrompt('listen', "I'm listening...", 'Speak now');
  recog.onerror = (e) => setHomePrompt('ready', 'Mic error, please try again.', e.error);
  
  // Si el usuario se queda en silencio, se lo decimos y volvemos a escuchar.
  recog.onend = () => {
    const isListening = promptText.textContent.includes("listening...");
    if (isConversationActive && isListening) {
        speakWithProgress("Sorry, I didn't catch that. Please try again.");
    }
  };

  let finalText = '';
  recog.onresult = (e) => {
    let interimText = '';
    for (let i = e.resultIndex; i < e.results.length; ++i) {
      if (e.results[i].isFinal) {
        finalText += e.results[i][0].transcript;
      } else {
        interimText += e.results[i][0].transcript;
      }
    }
    setHomePrompt('listen', finalText + interimText, 'Listening...');
    if (finalText) {
      recog.stop();
      handleUserTurn(finalText.trim());
      finalText = '';
    }
  };
}

// --- 6. ASIGNACIÓN DE EVENTOS ---
// Navegación
talkToGenieBtn.onclick = () => {
    unlockAudio();
    showScreen('homeScreen');
    isConversationActive = true; // Inicia el modo conversacional
    // CAMBIO: Inicia la conversación con un saludo del bot.
    startWithGreeting();
};
seeConversationBtn.onclick = () => showScreen('chatScreen');

// El botón de fin ahora detiene el ciclo de escucha.
endConversationBtn.onclick = () => {
    isConversationActive = false;
    if (recog) recog.stop();
    window.speechSynthesis.cancel();
    showScreen('closingScreen');
};
backToHomeBtn.onclick = () => showScreen('homeScreen');
askAnotherQuestionBtn.onclick = () => {
    setHomePrompt('ready', "I'm ready, ask me anything.");
    showScreen('homeScreen');
    isConversationActive = true; // Reinicia el modo conversacional
    startWithGreeting(); // Inicia con saludo también desde aquí
};

// Acciones
micBtn.onclick = () => {
  unlockAudio();
  if (!isConversationActive) {
    isConversationActive = true;
    startListening();
  }
};

document.querySelectorAll('.chip').forEach(chip => {
  chip.onclick = () => {
    unlockAudio();
    isConversationActive = true; // Activa el modo conversacional al usar un chip
    showScreen('homeScreen');
    setHomePrompt('ready', `Asking about: "${chip.dataset.q}"`);
    handleUserTurn(chip.dataset.q);
  };
});

const downloadFunction = () => alert('Download functionality is not implemented yet.');
downloadBtn.onclick = downloadFunction;
downloadBtnClosing.onclick = downloadFunction;
doneBtnIntro.onclick = () => alert('This could close the application.');

// --- 7. INICIALIZACIÓN ---
window.onload = () => {
  loadAndSetEnglishVoice();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadAndSetEnglishVoice;
  }
  showScreen('introScreen');
};
