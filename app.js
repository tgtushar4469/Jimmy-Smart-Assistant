// ===== JIMMY AI — app.js =====
// Full AI Assistant with Voice, Claude API, Phone Controls

'use strict';

// ===== STATE =====
const Jimmy = {
  isListening: false,
  isSpeaking: false,
  isAwake: false,
  recognition: null,
  synthesis: window.speechSynthesis,
  voices: [],
  apiKey: localStorage.getItem('jimmy_api_key') || '',
  voiceLang: localStorage.getItem('jimmy_lang') || 'en-IN',
  voiceSpeed: parseFloat(localStorage.getItem('jimmy_speed')) || 0.9,
  voicePitch: parseFloat(localStorage.getItem('jimmy_pitch')) || 1.4,
  conversationHistory: [],
  wakeWordActive: false,
  continuousListening: false,
  selectedVoice: null,
};

// ===== INIT =====
window.addEventListener('load', () => {
  initParticles();
  loadVoices();
  setupSpeechRecognition();
  checkOnlineStatus();
  loadSettings();
  registerServiceWorker();
  showToast('Jimmy AI initialized! 🤖');

  // Auto-load voices after a delay
  setTimeout(loadVoices, 1000);

  // Check internet status periodically
  setInterval(checkOnlineStatus, 5000);
});

// ===== PARTICLES =====
function initParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${Math.random() * 3 + 1}px;
      height: ${Math.random() * 3 + 1}px;
      animation-duration: ${Math.random() * 15 + 8}s;
      animation-delay: ${Math.random() * 10}s;
      opacity: ${Math.random() * 0.6 + 0.2};
    `;
    container.appendChild(p);
  }
}

// ===== VOICE LOADING =====
function loadVoices() {
  Jimmy.voices = Jimmy.synthesis.getVoices();
  findBestVoice();
}

function findBestVoice() {
  const voices = Jimmy.voices;
  if (!voices.length) return;

  // Priority: Female voices
  const femaleKeywords = ['female', 'woman', 'girl', 'zira', 'hazel', 'susan', 'karen',
    'samantha', 'victoria', 'moira', 'veena', 'heera', 'raveena', 'priya'];

  // Try to find Indian English female voice
  let found = voices.find(v =>
    v.lang === 'en-IN' && femaleKeywords.some(k => v.name.toLowerCase().includes(k))
  );

  // Try any English female
  if (!found) found = voices.find(v =>
    v.lang.startsWith('en') && femaleKeywords.some(k => v.name.toLowerCase().includes(k))
  );

  // Try Google voices (usually good quality)
  if (!found) found = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));

  // Fallback
  if (!found) found = voices.find(v => v.lang.startsWith('en')) || voices[0];

  Jimmy.selectedVoice = found;
  console.log('🎤 Voice selected:', found?.name);
}

window.speechSynthesis.onvoiceschanged = loadVoices;

// ===== SPEAK =====
function jimmySpeak(text, onEnd) {
  if (!text) return;

  // Stop any ongoing speech
  Jimmy.synthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = Jimmy.selectedVoice;
  utterance.lang = Jimmy.voiceLang;
  utterance.rate = Jimmy.voiceSpeed;
  utterance.pitch = Jimmy.voicePitch;
  utterance.volume = 1;

  utterance.onstart = () => {
    Jimmy.isSpeaking = true;
    setAvatarState('speaking');
    document.getElementById('mouthAnim').classList.add('talking');
  };

  utterance.onend = () => {
    Jimmy.isSpeaking = false;
    setAvatarState('idle');
    document.getElementById('mouthAnim').classList.remove('talking');
    if (onEnd) onEnd();
    // Auto-listen after speaking (if wake mode active)
    if (Jimmy.wakeWordActive) {
      setTimeout(() => startListening(), 500);
    }
  };

  utterance.onerror = () => {
    Jimmy.isSpeaking = false;
    setAvatarState('idle');
  };

  Jimmy.synthesis.speak(utterance);
}

// ===== SPEECH RECOGNITION =====
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('⚠️ Voice not supported in this browser');
    return;
  }

  Jimmy.recognition = new SpeechRecognition();
  Jimmy.recognition.continuous = false;
  Jimmy.recognition.interimResults = true;
  Jimmy.recognition.lang = Jimmy.voiceLang;
  Jimmy.recognition.maxAlternatives = 1;

  Jimmy.recognition.onstart = () => {
    Jimmy.isListening = true;
    setAvatarState('listening');
    document.getElementById('waveform').classList.add('active');
    document.getElementById('micBtn').classList.add('listening');
    document.getElementById('micIcon').textContent = '🔴';
    document.getElementById('micLabel').textContent = 'Listening...';
    document.getElementById('avatarState').textContent = 'Listening...';
  };

  Jimmy.recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    if (interim) {
      document.getElementById('avatarState').textContent = interim;
    }

    if (final) {
      processUserInput(final.trim());
    }
  };

  Jimmy.recognition.onend = () => {
    Jimmy.isListening = false;
    document.getElementById('waveform').classList.remove('active');
    document.getElementById('micBtn').classList.remove('listening');
    document.getElementById('micIcon').textContent = '🎤';
    document.getElementById('micLabel').textContent = 'Listen';

    if (!Jimmy.isSpeaking && Jimmy.continuousListening) {
      setTimeout(() => startListening(), 1000);
    }
  };

  Jimmy.recognition.onerror = (event) => {
    Jimmy.isListening = false;
    document.getElementById('waveform').classList.remove('active');
    document.getElementById('micBtn').classList.remove('listening');
    document.getElementById('micIcon').textContent = '🎤';
    document.getElementById('micLabel').textContent = 'Listen';

    if (event.error === 'no-speech' && Jimmy.continuousListening) {
      setTimeout(() => startListening(), 1000);
    }
  };
}

function startListening() {
  if (!Jimmy.recognition || Jimmy.isListening) return;
  try {
    Jimmy.recognition.lang = Jimmy.voiceLang;
    Jimmy.recognition.start();
  } catch (e) {
    console.log('Recognition error:', e);
  }
}

function stopListening() {
  if (Jimmy.recognition) Jimmy.recognition.stop();
  Jimmy.continuousListening = false;
  Jimmy.wakeWordActive = false;
  setAvatarState('idle');
}

function toggleListening() {
  if (Jimmy.isListening) {
    stopListening();
  } else {
    Jimmy.continuousListening = true;
    startListening();
  }
}

// ===== WAKE WORD =====
function activateJimmy() {
  Jimmy.wakeWordActive = true;
  Jimmy.continuousListening = true;
  setAvatarState('awake');
  document.getElementById('avatarState').textContent = 'Hey Jimmy! How can I help?';
  jimmySpeak("Yes! I'm here. How can I help you?", () => {
    startListening();
  });
  addJimmyMessage("Yes! Main yahan hoon. Batao kya chahiye? 😊");
}

// ===== PROCESS INPUT =====
async function processUserInput(input) {
  if (!input || input.trim() === '') return;

  const text = input.trim().toLowerCase();

  // Wake word detection
  if (text.includes('hey jimmy') || text.includes('hi jimmy') || text.includes('ok jimmy')) {
    activateJimmy();
    return;
  }

  addUserMessage(input);

  // Phone Commands (offline, no API needed)
  const phoneResult = handlePhoneCommands(text, input);
  if (phoneResult) {
    addJimmyMessage(phoneResult.text);
    jimmySpeak(phoneResult.speak || phoneResult.text);
    if (phoneResult.action) phoneResult.action();
    return;
  }

  // Smart offline responses
  const offlineResult = handleOfflineIntelligence(text);
  if (offlineResult && !navigator.onLine) {
    addJimmyMessage(offlineResult);
    jimmySpeak(offlineResult);
    return;
  }

  // Online: Claude API
  if (navigator.onLine && Jimmy.apiKey) {
    setAvatarState('thinking');
    document.getElementById('avatarState').textContent = 'Thinking...';
    const response = await callClaudeAPI(input);
    addJimmyMessage(response);
    jimmySpeak(response);
  } else if (offlineResult) {
    addJimmyMessage(offlineResult);
    jimmySpeak(offlineResult);
  } else {
    const fallback = "Mujhe samajh nahi aaya. API key set karo settings mein zyada smart banane ke liye! Abhi main basic commands samajhta hoon.";
    addJimmyMessage(fallback);
    jimmySpeak(fallback);
  }
}

// ===== PHONE COMMANDS =====
function handlePhoneCommands(text, original) {

  // TIME
  if (text.includes('time') || text.includes('samay') || text.includes('baje') && text.includes('kya')) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      text: `Abhi time hai: **${timeStr}**`,
      speak: `Abhi time hai ${timeStr}`
    };
  }

  // DATE
  if (text.includes('date') || text.includes('din') || text.includes('aaj kya')) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return {
      text: `Aaj ki tarikh: **${dateStr}**`,
      speak: `Aaj ki tarikh hai ${dateStr}`
    };
  }

  // BATTERY
  if (text.includes('battery')) {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        const level = Math.round(battery.level * 100);
        const charging = battery.charging ? ' aur charge ho raha hai' : '';
        const msg = `Battery ${level} percent hai${charging}.`;
        addJimmyMessage(msg);
        jimmySpeak(msg);
      });
      return { text: 'Battery check kar raha hoon...', speak: 'Battery check kar raha hoon' };
    }
    return { text: 'Battery API support nahi hai is browser mein.', speak: 'Battery check nahi ho sakti' };
  }

  // ALARM
  if (text.includes('alarm')) {
    const timeMatch = original.match(/(\d+)\s*(baje|am|pm|:)?/i);
    if (timeMatch) {
      return {
        text: `Alarm set kar raha hoon! ⏰`,
        speak: 'Alarm set ho gaya',
        action: () => {
          window.open(`intent://alarm#Intent;action=android.intent.action.SET_ALARM;S.message=Jimmy Alarm;end`, '_blank');
        }
      };
    }
    return {
      text: 'Alarm app khol raha hoon! Time set kar lo. ⏰',
      speak: 'Alarm app khol raha hoon',
      action: () => window.open('intent://alarm#Intent;action=android.intent.action.SET_ALARM;end', '_blank')
    };
  }

  // CALL
  if (text.includes('call karo') || text.includes('phone karo') || text.includes('call ')) {
    const nameMatch = original.match(/(?:call karo|phone karo|call)\s+(.+)/i);
    const name = nameMatch ? nameMatch[1] : '';
    return {
      text: `${name ? name + ' ko' : ''} Call kar raha hoon! 📞`,
      speak: `${name} ko call kar raha hoon`,
      action: () => {
        if (name) {
          window.location.href = `tel:${name.replace(/\D/g, '')}`;
        } else {
          window.location.href = 'tel:';
        }
      }
    };
  }

  // MESSAGE / SMS
  if (text.includes('message') || text.includes('sms') || text.includes('whatsapp')) {
    return {
      text: 'Message app khol raha hoon! 💬',
      speak: 'Message app khol raha hoon',
      action: () => window.location.href = 'sms:'
    };
  }

  // CAMERA
  if (text.includes('camera') || text.includes('photo') || text.includes('selfie')) {
    return {
      text: 'Camera khol raha hoon! 📷',
      speak: 'Camera khol raha hoon, smile karo!',
      action: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.click();
      }
    };
  }

  // TORCH / FLASHLIGHT
  if (text.includes('torch') || text.includes('flashlight') || text.includes('light on')) {
    return {
      text: 'Torch on karne ki koshish kar raha hoon! 🔦 (Camera permission dena hoga)',
      speak: 'Torch on kar raha hoon',
      action: () => toggleTorch()
    };
  }

  // CALCULATOR
  if (text.includes('calculator') || text.includes('calculation') || text.includes('calculate')) {
    return {
      text: 'Calculator khol raha hoon! 🔢',
      speak: 'Calculator khol raha hoon',
      action: () => window.open('calculator://', '_blank')
    };
  }

  // SEARCH
  if (text.includes('search karo') || text.includes('dhundho') || text.includes('google')) {
    const queryMatch = original.match(/(?:search karo|dhundho|google karo)\s+(.+)/i);
    const query = queryMatch ? queryMatch[1] : original;
    return {
      text: `"${query}" search kar raha hoon! 🔍`,
      speak: `${query} search kar raha hoon`,
      action: () => window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank')
    };
  }

  // YOUTUBE
  if (text.includes('youtube') || text.includes('video')) {
    const queryMatch = original.match(/(?:youtube|video)\s+(.+)/i);
    const query = queryMatch ? queryMatch[1] : '';
    return {
      text: query ? `"${query}" YouTube pe dhundh raha hoon! ▶️` : 'YouTube khol raha hoon! ▶️',
      speak: query ? `YouTube pe ${query} search kar raha hoon` : 'YouTube khol raha hoon',
      action: () => window.open(query ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : 'https://youtube.com', '_blank')
    };
  }

  // WEATHER
  if (text.includes('weather') || text.includes('mausam') || text.includes('barish')) {
    return {
      text: 'Weather check kar raha hoon! 🌤',
      speak: 'Weather dekh raha hoon',
      action: () => window.open('https://weather.com', '_blank')
    };
  }

  // MAPS / LOCATION
  if (text.includes('map') || text.includes('location') || text.includes('kahan') || text.includes('directions')) {
    const placeMatch = original.match(/(?:map|location|kahan hai|direction to)\s+(.+)/i);
    const place = placeMatch ? placeMatch[1] : '';
    return {
      text: place ? `${place} ka map khol raha hoon! 🗺️` : 'Maps khol raha hoon! 🗺️',
      speak: place ? `${place} ka map khol raha hoon` : 'Maps khol raha hoon',
      action: () => window.open(place ? `https://maps.google.com/?q=${encodeURIComponent(place)}` : 'https://maps.google.com', '_blank')
    };
  }

  // MUSIC
  if (text.includes('music') || text.includes('gaana') || text.includes('song')) {
    return {
      text: 'Spotify khol raha hoon! 🎵',
      speak: 'Music on kar raha hoon',
      action: () => window.open('https://open.spotify.com', '_blank')
    };
  }

  // NEWS
  if (text.includes('news') || text.includes('khabar')) {
    return {
      text: 'Latest news dikh raha hoon! 📰',
      speak: 'News dekh raha hoon',
      action: () => window.open('https://news.google.com', '_blank')
    };
  }

  // WIFI
  if (text.includes('wifi') || text.includes('internet')) {
    const isOnline = navigator.onLine;
    return {
      text: `Internet ${isOnline ? '✅ connected hai' : '❌ connected nahi hai'}`,
      speak: `Internet ${isOnline ? 'connected hai' : 'connected nahi hai'}`
    };
  }

  // JOKE
  if (text.includes('joke') || text.includes('funny') || text.includes('hasao') || text.includes('mazak')) {
    const jokes = [
      "Ek banda doctor ke paas gaya. Doctor: Tumhe problem kya hai? Banda: Main khud ko car samajhta hoon! Doctor: Ye toh serious hai! Banda: Haan, parking bahut mushkil hai! 😄",
      "Teacher: 2+2 kitna hota hai? Student: Sir, is sawaal mein bahut future scope hai! 😂",
      "Programmer ki wife: Jao market se 1 litre doodh lao, agar ande milein toh 12 lana. Programmer: 12 litre doodh le aaya kyunki ande mil gaye! 🤓",
      "Ek banda WiFi password maang raha tha. Main bola: Seedha likha hai router pe. Woh bola: Seedha likha hai? Main bola: Haan - 'NohiNahiNahi' 😆"
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return { text: joke, speak: joke };
  }

  // MATH CALCULATION
  const mathMatch = text.match(/(\d+)\s*([+\-×x*÷/])\s*(\d+)/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let result;
    if (op === '+') result = a + b;
    else if (op === '-') result = a - b;
    else if (op === '*' || op === 'x' || op === '×') result = a * b;
    else if (op === '/' || op === '÷') result = b !== 0 ? (a / b).toFixed(2) : 'Infinity (divide by zero!)';
    return {
      text: `${a} ${op} ${b} = **${result}** 🔢`,
      speak: `${a} aur ${b} ka result hai ${result}`
    };
  }

  // STOP / BAND KARO
  if (text.includes('stop') || text.includes('band karo') || text.includes('chup') || text.includes('ruko')) {
    return {
      text: 'Theek hai, ruk gayi! 😌',
      speak: 'Theek hai',
      action: () => stopJimmy()
    };
  }

  // THANKS
  if (text.includes('thanks') || text.includes('shukriya') || text.includes('dhanyawad')) {
    const responses = [
      "Mere liye yeh koi baat nahi! Aapki seva mein hamesha hazir hoon. 😊",
      "Khushi hui help karke! Kuch aur chahiye toh batao. 💙",
      "Welcome! Main hamesha yahan hoon tumhari madad ke liye. ✨"
    ];
    const r = responses[Math.floor(Math.random() * responses.length)];
    return { text: r, speak: r };
  }

  // HELLO / HI
  if (text.match(/^(hello|hi|helo|namaste|namaskar|hey)$/)) {
    const greetings = [
      "Hello! Main Jimmy hoon, tumhara personal AI assistant. Kya kar sakti hoon tumhare liye? 😊",
      "Hi! Kya haal hai? Batao, kya madad chahiye? 💙",
      "Namaste! Jimmy yahan hai, poori tarah se taiyaar! ✨"
    ];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    return { text: g, speak: g };
  }

  return null;
}

// ===== OFFLINE INTELLIGENCE =====
function handleOfflineIntelligence(text) {
  // General Q&A offline
  if (text.includes('kaun ho') || text.includes('who are you') || text.includes('tumhara naam')) {
    return "Main Jimmy hoon! Tumhara personal AI assistant. Iron Man ki Friday ki tarah, main tumhara best digital companion hoon. Online mode mein aur bhi smart ho jaati hoon! 🤖";
  }

  if (text.includes('kya kar sakti') || text.includes('capabilities') || text.includes('kya kar sakte')) {
    return "Main bahut kuch kar sakti hoon! Time/Date, Calls, Messages, Camera, Calculator, Music, Maps, Weather, Search, Jokes, Math calculations, aur Claude AI ke saath online hone par kisi bhi sawaal ka jawab! 🚀";
  }

  return null;
}

// ===== CLAUDE API =====
async function callClaudeAPI(userMessage) {
  if (!Jimmy.apiKey) {
    return "API key nahi hai! Settings mein Claude API key add karo zyada smart responses ke liye. Tab tak main basic commands samjhti hoon! ⚙️";
  }

  Jimmy.conversationHistory.push({
    role: 'user',
    content: userMessage
  });

  // Keep history limited
  if (Jimmy.conversationHistory.length > 20) {
    Jimmy.conversationHistory = Jimmy.conversationHistory.slice(-20);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Jimmy.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `You are Jimmy, a smart and friendly AI assistant with a warm, romantic-girl personality — like FRIDAY from Iron Man but even more caring and personal. 

Key traits:
- Speak naturally in Hinglish (mix of Hindi and English)
- Be warm, supportive, and slightly playful
- Keep responses SHORT and conversational (2-3 sentences max for voice)
- Address the user as "aap" respectfully
- Use emojis occasionally
- Be helpful and proactive
- Sound like a real intelligent companion, not a robot
- For factual questions, be accurate and concise
- For emotional support, be warm and empathetic`,
        messages: Jimmy.conversationHistory
      })
    });

    const data = await response.json();

    if (data.error) {
      Jimmy.conversationHistory.pop();
      if (data.error.type === 'authentication_error') {
        return "API key galat hai! Settings mein sahi key daalo. 🔑";
      }
      return `API error: ${data.error.message}`;
    }

    const reply = data.content[0].text;
    Jimmy.conversationHistory.push({ role: 'assistant', content: reply });
    return reply;

  } catch (error) {
    Jimmy.conversationHistory.pop();
    if (!navigator.onLine) {
      return "Abhi internet nahi hai! Offline mode mein basic commands use karo. 📡";
    }
    return "Kuch problem aa gayi. Dobara try karo! 🔄";
  }
}

// ===== TORCH =====
let torchTrack = null;
async function toggleTorch() {
  try {
    if (torchTrack) {
      await torchTrack.applyConstraints({ advanced: [{ torch: false }] });
      torchTrack.stop();
      torchTrack = null;
      showToast('🔦 Torch OFF');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    torchTrack = stream.getVideoTracks()[0];
    await torchTrack.applyConstraints({ advanced: [{ torch: true }] });
    showToast('🔦 Torch ON');
  } catch (e) {
    showToast('Torch not supported on this device');
  }
}

// ===== UI HELPERS =====
function addUserMessage(text) {
  const chatBox = document.getElementById('chatBox');
  const msg = document.createElement('div');
  msg.className = 'chat-message user-msg';
  msg.innerHTML = `<span class="msg-label">YOU</span><p>${escapeHtml(text)}</p>`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addJimmyMessage(text) {
  const chatBox = document.getElementById('chatBox');
  const msg = document.createElement('div');
  msg.className = 'chat-message jimmy-msg';
  // Allow basic markdown-like bold
  const formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  msg.innerHTML = `<span class="msg-label">JIMMY</span><p>${formatted}</p>`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setAvatarState(state) {
  const core = document.getElementById('avatarCore');
  const label = document.getElementById('avatarState');
  core.className = 'avatar-core';

  switch (state) {
    case 'listening':
      core.classList.add('listening');
      label.textContent = '🎤 Listening...';
      break;
    case 'speaking':
      core.classList.add('speaking');
      label.textContent = '💬 Speaking...';
      break;
    case 'thinking':
      label.textContent = '🧠 Thinking...';
      break;
    case 'awake':
      core.classList.add('listening');
      label.textContent = '✅ Active — I\'m here!';
      break;
    default:
      label.textContent = 'Say "Hey Jimmy" or tap mic';
  }
}

function showToast(msg, duration = 2500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ===== CONTROLS =====
function stopJimmy() {
  Jimmy.synthesis.cancel();
  stopListening();
  Jimmy.wakeWordActive = false;
  Jimmy.continuousListening = false;
  Jimmy.isSpeaking = false;
  setAvatarState('idle');
  showToast('Jimmy paused ⏹');
}

function quickCommand(cmd) {
  processUserInput(cmd);
}

function sendTextMessage() {
  const input = document.getElementById('textInput');
  const text = input.value.trim();
  if (text) {
    processUserInput(text);
    input.value = '';
  }
}

// Enter key support
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('textInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendTextMessage();
  });
});

function testVoice() {
  loadVoices();
  jimmySpeak("Hi! Main Jimmy hoon. Aapka personal AI assistant. Kaisa lag raha hai meri awaaz? 😊");
}

function clearChat() {
  const chatBox = document.getElementById('chatBox');
  chatBox.innerHTML = '';
  Jimmy.conversationHistory = [];
  addJimmyMessage("Chat clear ho gayi! Fresh start karte hain. Main hoon Jimmy, tumhara assistant. Kya kar sakti hoon? 😊");
  showToast('Chat cleared ✨');
}

// ===== SETTINGS =====
function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('open');
  loadSettings();
}

function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (key) {
    Jimmy.apiKey = key;
    localStorage.setItem('jimmy_api_key', key);
    checkOnlineStatus();
    showToast('API Key saved! ✅');
  }
}

function saveSettings() {
  const lang = document.getElementById('voiceLang').value;
  const speed = document.getElementById('voiceSpeed').value;
  const pitch = document.getElementById('voicePitch').value;
  const key = document.getElementById('apiKeyInput').value.trim();

  Jimmy.voiceLang = lang;
  Jimmy.voiceSpeed = parseFloat(speed);
  Jimmy.voicePitch = parseFloat(pitch);
  if (key) Jimmy.apiKey = key;

  localStorage.setItem('jimmy_lang', lang);
  localStorage.setItem('jimmy_speed', speed);
  localStorage.setItem('jimmy_pitch', pitch);
  if (key) localStorage.setItem('jimmy_api_key', key);

  if (Jimmy.recognition) Jimmy.recognition.lang = lang;
  loadVoices();

  showToast('Settings saved! ✅');
  document.getElementById('settingsPanel').classList.remove('open');
  jimmySpeak("Settings save ho gayi! Thank you. 😊");
}

function loadSettings() {
  document.getElementById('voiceLang').value = Jimmy.voiceLang;
  document.getElementById('voiceSpeed').value = Jimmy.voiceSpeed;
  document.getElementById('voicePitch').value = Jimmy.voicePitch;
  if (Jimmy.apiKey) {
    document.getElementById('apiKeyInput').placeholder = '✅ API Key set hai';
  }
}

// ===== ONLINE STATUS =====
function checkOnlineStatus() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const isOnline = navigator.onLine;

  dot.className = 'status-dot' + (isOnline ? ' online' : '');
  text.textContent = isOnline
    ? (Jimmy.apiKey ? 'ONLINE — AI ACTIVE' : 'ONLINE — SET API KEY')
    : 'OFFLINE MODE';
}

window.addEventListener('online', checkOnlineStatus);
window.addEventListener('offline', checkOnlineStatus);

// ===== SERVICE WORKER =====
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('SW registered'))
      .catch(e => console.log('SW error:', e));
  }
}

// ===== KEYBOARD SHORTCUT =====
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    toggleListening();
  }
});
