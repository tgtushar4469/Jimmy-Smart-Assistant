// ===== JIMMY AI — app.js =====
// Always-ON | Background Active | Full Phone Control | Tushar Sir Mode

'use strict';

const Jimmy = {
  isListening: false,
  isSpeaking: false,
  recognition: null,
  synthesis: window.speechSynthesis,
  voices: [],
  apiKey: localStorage.getItem('jimmy_api_key') || '',
  voiceLang: localStorage.getItem('jimmy_lang') || 'en-IN',
  voiceSpeed: parseFloat(localStorage.getItem('jimmy_speed')) || 0.82,
  voicePitch: parseFloat(localStorage.getItem('jimmy_pitch')) || 1.65,
  conversationHistory: [],
  wakeWordActive: true,
  continuousListening: true,
  selectedVoice: null,
  userName: 'Tushar Sir',
  whatsappMode: false,
  whatsappContact: '',
  restartAttempts: 0,
  maxRestarts: 9999,
  keepAliveInterval: null,
  wakeLock: null,
};

// ===== INIT =====
window.addEventListener('load', async () => {
  initParticles();
  loadVoices();
  setupSpeechRecognition();
  checkOnlineStatus();
  loadSettings();
  registerServiceWorker();
  await requestAllPermissions();
  acquireWakeLock();
  startKeepAlive();

  setTimeout(() => {
    addJimmyMessage(`Hello ${Jimmy.userName}! Main Jimmy hoon — aapki personal AI assistant. Ab main hamesha active rahungi! Bas boliye. 💙`);
    jimmySpeak(`Hello ${Jimmy.userName}! Main Jimmy hoon. Ab main hamesha active hoon. Kuch bhi chahiye bas boliye.`, () => {
      startListening();
    });
  }, 1500);

  setTimeout(loadVoices, 1000);
  setInterval(checkOnlineStatus, 5000);
});

// ===== REQUEST ALL PERMISSIONS =====
async function requestAllPermissions() {
  showToast('Permissions le rahi hoon...');

  // Microphone
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    showToast('✅ Microphone permission mili!');
  } catch (e) {
    showToast('❌ Mic permission do settings mein!');
  }

  // Camera
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    showToast('✅ Camera permission mili!');
  } catch (e) { console.log('Camera:', e); }

  // Notifications
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') showToast('✅ Notification permission mili!');
  } catch (e) { console.log('Notification:', e); }

  // Geolocation
  try {
    navigator.geolocation.getCurrentPosition(() => showToast('✅ Location permission mili!'));
  } catch (e) { console.log('Location:', e); }

  // Battery
  if ('getBattery' in navigator) await navigator.getBattery();

  // Vibration test
  if ('vibrate' in navigator) navigator.vibrate(100);

  showToast('✅ Sab permissions ready!');
}

// ===== WAKE LOCK — Screen & App Always ON =====
async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      Jimmy.wakeLock = await navigator.wakeLock.request('screen');
      console.log('WakeLock acquired — screen will stay on');

      Jimmy.wakeLock.addEventListener('release', () => {
        console.log('WakeLock released — reacquiring...');
        setTimeout(acquireWakeLock, 1000);
      });
    }
  } catch (e) {
    console.log('WakeLock error:', e);
    setTimeout(acquireWakeLock, 5000);
  }
}

// Re-acquire wake lock when page becomes visible
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    await acquireWakeLock();
    // Restart listening if stopped
    if (!Jimmy.isListening && !Jimmy.isSpeaking) {
      setTimeout(() => startListening(), 500);
    }
  }
});

// ===== KEEP ALIVE — App Never Stops =====
function startKeepAlive() {
  // Ping every 20 seconds to keep service worker alive
  Jimmy.keepAliveInterval = setInterval(() => {
    if (!Jimmy.isListening && !Jimmy.isSpeaking) {
      startListening();
    }
    // Keep synthesis alive
    if (!Jimmy.synthesis.speaking && !Jimmy.isListening) {
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      Jimmy.synthesis.speak(silent);
    }
  }, 20000);

  // Prevent page sleep via audio context
  keepAudioContextAlive();
}

function keepAudioContextAlive() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0; // Silent
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    console.log('Audio context alive — app stays active');
  } catch (e) {
    console.log('AudioContext:', e);
  }
}

// ===== PARTICLES =====
function initParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left:${Math.random()*100}%;
      width:${Math.random()*3+1}px;
      height:${Math.random()*3+1}px;
      animation-duration:${Math.random()*15+8}s;
      animation-delay:${Math.random()*10}s;
      opacity:${Math.random()*0.5+0.2};
      background:${Math.random()>0.5?'#00d4ff':'#ff6b9d'};
    `;
    container.appendChild(p);
  }
}

// ===== VOICE LOADING =====
function loadVoices() {
  Jimmy.voices = Jimmy.synthesis.getVoices();
  findBestVoice();
}
window.speechSynthesis.onvoiceschanged = loadVoices;

function findBestVoice() {
  const voices = Jimmy.voices;
  if (!voices.length) return;

  const preferred = [
    'Google UK English Female',
    'Microsoft Zira',
    'Microsoft Heera',
    'Samantha','Karen','Veena','Moira','Victoria',
  ];

  let found = null;
  for (const name of preferred) {
    found = voices.find(v => v.name.includes(name));
    if (found) break;
  }

  if (!found) {
    const femaleKeys = ['female','woman','girl','zira','hazel','susan','karen',
      'samantha','victoria','moira','veena','heera','raveena','priya'];
    found = voices.find(v => femaleKeys.some(k => v.name.toLowerCase().includes(k)));
  }

  if (!found) found = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
  if (!found) found = voices.find(v => v.lang.startsWith('en')) || voices[0];

  Jimmy.selectedVoice = found;
}

// ===== SPEAK — Friday Romantic Style =====
function jimmySpeak(text, onEnd) {
  if (!text) return;
  Jimmy.synthesis.cancel();

  const cleanText = text.replace(/[\u{1F300}-\u{1FFFF}]/gu,'').replace(/\*\*/g,'').trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.voice = Jimmy.selectedVoice;
  utterance.lang = Jimmy.voiceLang;
  utterance.rate = Jimmy.voiceSpeed;
  utterance.pitch = Jimmy.voicePitch;
  utterance.volume = 1;

  utterance.onstart = () => {
    Jimmy.isSpeaking = true;
    setAvatarState('speaking');
    document.getElementById('mouthAnim').classList.add('talking');
    document.getElementById('waveform').classList.add('active');
  };

  utterance.onend = () => {
    Jimmy.isSpeaking = false;
    setAvatarState('idle');
    document.getElementById('mouthAnim').classList.remove('talking');
    document.getElementById('waveform').classList.remove('active');
    if (onEnd) onEnd();
    // ALWAYS restart listening after speaking
    setTimeout(() => startListening(), 400);
  };

  utterance.onerror = () => {
    Jimmy.isSpeaking = false;
    setAvatarState('idle');
    document.getElementById('waveform').classList.remove('active');
    setTimeout(() => startListening(), 400);
  };

  Jimmy.synthesis.speak(utterance);
}

// ===== SPEECH RECOGNITION — ALWAYS ON =====
function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice not supported — use Chrome browser'); return; }

  Jimmy.recognition = new SR();
  Jimmy.recognition.continuous = true;   // Continuous listening!
  Jimmy.recognition.interimResults = true;
  Jimmy.recognition.lang = Jimmy.voiceLang;
  Jimmy.recognition.maxAlternatives = 1;

  Jimmy.recognition.onstart = () => {
    Jimmy.isListening = true;
    Jimmy.restartAttempts = 0;
    setMicActive(true);
    document.getElementById('avatarState').textContent = 'Hamesha sun rahi hoon...';
  };

  Jimmy.recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }
    if (interim) document.getElementById('avatarState').textContent = interim;
    if (final) {
      processUserInput(final.trim());
    }
  };

  Jimmy.recognition.onend = () => {
    Jimmy.isListening = false;
    setMicActive(false);
    // ALWAYS restart — never stop
    if (Jimmy.restartAttempts < Jimmy.maxRestarts) {
      Jimmy.restartAttempts++;
      const delay = Jimmy.isSpeaking ? 800 : 300;
      setTimeout(() => startListening(), delay);
    }
  };

  Jimmy.recognition.onerror = (event) => {
    Jimmy.isListening = false;
    setMicActive(false);
    console.log('Mic error:', event.error);

    // Always restart regardless of error
    const delay = event.error === 'network' ? 3000 : 500;
    setTimeout(() => startListening(), delay);
  };
}

function startListening() {
  if (!Jimmy.recognition || Jimmy.isListening || Jimmy.isSpeaking) return;
  try {
    Jimmy.recognition.lang = Jimmy.voiceLang;
    Jimmy.recognition.start();
  } catch (e) {
    setTimeout(() => startListening(), 1000);
  }
}

function setMicActive(active) {
  const micBtn = document.getElementById('micBtn');
  const micIcon = document.getElementById('micIcon');
  const micLabel = document.getElementById('micLabel');
  if (active) {
    micBtn.classList.add('listening');
    micIcon.textContent = '🔴';
    micLabel.textContent = 'Active';
  } else {
    micBtn.classList.remove('listening');
    micIcon.textContent = '🎤';
    micLabel.textContent = 'Always ON';
  }
}

function toggleListening() {
  // Jimmy always listens — this just shows status
  showToast('Jimmy hamesha sun rahi hai! 💙');
}

// ===== ANNOUNCE INCOMING CALL =====
function announceCall(callerName) {
  const name = callerName || 'Koi anjaan';
  const msg = `${Jimmy.userName}, ${name} ka call aa raha hai! Call uthana chahte hain?`;

  if ('vibrate' in navigator) navigator.vibrate([500,300,500,300,500,300,500]);

  showNotification(`📞 Incoming Call`, `${name} call kar raha hai!`);
  addJimmyMessage(`📞 **${name}** ka call aa raha hai ${Jimmy.userName}! Call uthana chahte hain?`);
  jimmySpeak(msg);
}

function showNotification(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'icon-192.png', vibrate: [500,300,500] });
  }
}

// ===== WHATSAPP MODE =====
function startWhatsAppMode(contact, message) {
  if (contact && message) {
    sendWhatsApp(contact, message);
    return;
  }
  if (contact && !message) {
    Jimmy.whatsappMode = true;
    Jimmy.whatsappContact = contact;
    const reply = `${Jimmy.userName}, ${contact} ko kya message karna hai? Boliye, main likh lungi.`;
    addJimmyMessage(reply);
    jimmySpeak(reply);
    return;
  }
  Jimmy.whatsappMode = 'asking_contact';
  const reply = `${Jimmy.userName}, kisko WhatsApp message karna hai? Naam ya number boliye.`;
  addJimmyMessage(reply);
  jimmySpeak(reply);
}

function sendWhatsApp(contact, message) {
  Jimmy.whatsappMode = false;
  Jimmy.whatsappContact = '';
  const phone = contact.replace(/\D/g,'');
  const url = phone.length >= 10
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const reply = `${Jimmy.userName}, "${message}" — yeh message ${contact} ko bhej rahi hoon! ✉️`;
  addJimmyMessage(reply);
  jimmySpeak(reply);
  setTimeout(() => window.open(url, '_blank'), 1500);
}

// ===== PROCESS INPUT =====
async function processUserInput(input) {
  if (!input || input.trim().length < 2) return;
  const text = input.trim().toLowerCase();

  // Wake word — already active but respond warmly
  if (text.includes('hey jimmy') || text.includes('hi jimmy') || text.includes('ok jimmy')) {
    const replies = [
      `Haan ${Jimmy.userName}! Batao, kya chahiye?`,
      `Ji ${Jimmy.userName}! Main sun rahi hoon.`,
      `Bilkul ${Jimmy.userName}! Kya karu aapke liye?`,
    ];
    const r = replies[Math.floor(Math.random()*replies.length)];
    addJimmyMessage(r+' 💙');
    jimmySpeak(r);
    return;
  }

  // WhatsApp collecting message
  if (Jimmy.whatsappMode === true && Jimmy.whatsappContact) {
    addUserMessage(input);
    sendWhatsApp(Jimmy.whatsappContact, input);
    return;
  }

  // WhatsApp collecting contact
  if (Jimmy.whatsappMode === 'asking_contact') {
    Jimmy.whatsappContact = input;
    Jimmy.whatsappMode = true;
    addUserMessage(input);
    const reply = `${Jimmy.userName}, ${input} ko kya message karna hai? Boliye.`;
    addJimmyMessage(reply);
    jimmySpeak(reply);
    return;
  }

  addUserMessage(input);

  const phoneResult = handlePhoneCommands(text, input);
  if (phoneResult) {
    addJimmyMessage(phoneResult.text);
    if (phoneResult.speak) jimmySpeak(phoneResult.speak);
    if (phoneResult.action) phoneResult.action();
    return;
  }

  const offlineResult = handleOfflineIntelligence(text);
  if (offlineResult && !navigator.onLine) {
    addJimmyMessage(offlineResult);
    jimmySpeak(offlineResult);
    return;
  }

  if (navigator.onLine && Jimmy.apiKey) {
    setAvatarState('thinking');
    document.getElementById('avatarState').textContent = 'Soch rahi hoon...';
    const response = await callGeminiAPI(input);
    addJimmyMessage(response);
    jimmySpeak(response);
  } else if (offlineResult) {
    addJimmyMessage(offlineResult);
    jimmySpeak(offlineResult);
  } else {
    const f = `${Jimmy.userName}, Settings mein Gemini API key daalo — main aur bhi smart ho jaaungi!`;
    addJimmyMessage(f);
    jimmySpeak(f);
  }
}

// ===== PHONE COMMANDS =====
function handlePhoneCommands(text, original) {

  // INCOMING CALL ANNOUNCE
  if (text.includes('call aa raha') || text.includes('incoming call') || text.includes('call aaya')) {
    const nm = original.match(/(?:call aa raha|incoming call|call aaya)\s+(.+)/i);
    const caller = nm ? nm[1].trim() : 'Koi';
    announceCall(caller);
    return { text: `📞 ${caller} ka call announce kar rahi hoon!`, speak: null };
  }

  // CALL UTHAO YES
  if (text.includes('haan uthao') || text.includes('call uthao') || text.includes('receive karo') || text.includes('uthao')) {
    return {
      text: `${Jimmy.userName}, call uth raha hai! 📞`,
      speak: `Ji ${Jimmy.userName}`,
      action: () => window.location.href = 'tel:'
    };
  }

  // CALL KARO
  if ((text.includes('call karo') || text.includes('phone karo')) && !text.includes('incoming')) {
    const nm = original.match(/(?:call karo|phone karo)\s+(.+)/i);
    const name = nm ? nm[1].trim() : '';
    const num = name.replace(/\D/g,'');
    return {
      text: `**${name || 'number'}** ko call kar rahi hoon ${Jimmy.userName}! 📞`,
      speak: `${Jimmy.userName}, ${name} ko call kar rahi hoon`,
      action: () => { window.location.href = num.length>=10 ? `tel:${num}` : 'tel:'; }
    };
  }

  // WHATSAPP
  if (text.includes('whatsapp') || text.includes('whats app')) {
    const match = original.match(/(?:whatsapp|whats app)\s+(?:karo|bhejo|message|send)?\s*(.+?)(?:\s+ko|\s+par)?\s*(?:message|msg|send|bolna|likhna)?\s*(.*)/i);
    const contact = match ? match[1].trim() : '';
    const msg = match ? match[2].trim() : '';
    startWhatsAppMode(contact || null, msg || null);
    return { text: `WhatsApp mode active! 💬`, speak: null };
  }

  // SMS
  if (text.includes('sms') || text.includes('message bhejo') || text.includes('message karo')) {
    const match = original.match(/(?:sms|message bhejo|message karo)\s+(.+?)\s+(?:ko|par)\s+(.*)/i);
    const contact = match ? match[1] : '';
    const msg = match ? match[2] : '';
    if (contact && msg) {
      return {
        text: `**${contact}** ko message bhej rahi hoon! 💬`,
        speak: `${Jimmy.userName}, ${contact} ko message bhej rahi hoon`,
        action: () => window.location.href = `sms:${contact.replace(/\D/g,'')}?body=${encodeURIComponent(msg)}`
      };
    }
    return {
      text: `Message app khol rahi hoon! 💬`,
      speak: `Message app khol rahi hoon ${Jimmy.userName}`,
      action: () => window.location.href = 'sms:'
    };
  }

  // TIME
  if (text.includes('time') || text.includes('kitne baje') || text.includes('samay')) {
    const t = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
    return { text:`${Jimmy.userName}, abhi time hai: **${t}** ⏰`, speak:`${Jimmy.userName}, abhi time hai ${t}` };
  }

  // DATE
  if (text.includes('date') || text.includes('tarikh') || text.includes('aaj kya')) {
    const d = new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    return { text:`${Jimmy.userName}, aaj ki tarikh: **${d}** 📅`, speak:`${Jimmy.userName}, aaj ki tarikh hai ${d}` };
  }

  // BATTERY
  if (text.includes('battery')) {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(b => {
        const level = Math.round(b.level*100);
        const ch = b.charging ? ', aur charge ho raha hai' : '';
        const msg = `${Jimmy.userName}, battery ${level} percent hai${ch}.`;
        addJimmyMessage(msg); jimmySpeak(msg);
      });
      return { text:'Battery check kar rahi hoon...', speak:null };
    }
    return { text:'Battery API support nahi.', speak:`${Jimmy.userName}, battery check nahi ho sakti` };
  }

  // ALARM
  if (text.includes('alarm')) {
    return {
      text:`${Jimmy.userName}, alarm set kar rahi hoon! ⏰`,
      speak:`${Jimmy.userName}, alarm set ho gaya`,
      action:()=>window.open('intent://alarm#Intent;action=android.intent.action.SET_ALARM;end','_blank')
    };
  }

  // CAMERA / PHOTO
  if (text.includes('camera') || text.includes('photo') || text.includes('selfie')) {
    return {
      text:`Camera khol rahi hoon ${Jimmy.userName}! 📷 Smile!`,
      speak:`${Jimmy.userName}, camera khol rahi hoon. Smile karo!`,
      action:()=>{
        const inp=document.createElement('input');
        inp.type='file'; inp.accept='image/*'; inp.capture='environment'; inp.click();
      }
    };
  }

  // TORCH
  if (text.includes('torch') || text.includes('flashlight') || text.includes('light on') || text.includes('light off')) {
    return {
      text:`Torch toggle kar rahi hoon! 🔦`,
      speak:`${Jimmy.userName}, torch toggle kar rahi hoon`,
      action:()=>toggleTorch()
    };
  }

  // CALCULATOR
  if (text.includes('calculator') || text.includes('calculate')) {
    return {
      text:`Calculator khol rahi hoon! 🔢`,
      speak:`${Jimmy.userName}, calculator khol rahi hoon`,
      action:()=>window.open('calculator://','_blank')
    };
  }

  // MATH
  const mathM = text.match(/(\d+)\s*([+\-×x*÷/])\s*(\d+)/);
  if (mathM) {
    const a=parseFloat(mathM[1]),op=mathM[2],b=parseFloat(mathM[3]);
    let r;
    if(op==='+') r=a+b;
    else if(op==='-') r=a-b;
    else if(op==='*'||op==='x'||op==='×') r=a*b;
    else if(op==='/'||op==='÷') r=b!==0?(a/b).toFixed(2):'Infinity';
    return {
      text:`${a} ${op} ${b} = **${r}** 🔢`,
      speak:`${Jimmy.userName}, ${a} aur ${b} ka result hai ${r}`
    };
  }

  // SEARCH
  if (text.includes('search karo') || text.includes('dhundho') || text.includes('google karo')) {
    const qm=original.match(/(?:search karo|dhundho|google karo)\s+(.+)/i);
    const q=qm?qm[1]:original;
    return {
      text:`"${q}" search kar rahi hoon! 🔍`,
      speak:`${Jimmy.userName}, ${q} search kar rahi hoon`,
      action:()=>window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`,'_blank')
    };
  }

  // YOUTUBE
  if (text.includes('youtube') || text.includes('video chalao')) {
    const qm=original.match(/(?:youtube|video chalao)\s+(.+)/i);
    const q=qm?qm[1]:'';
    return {
      text:q?`"${q}" YouTube pe! ▶️`:`YouTube khol rahi hoon! ▶️`,
      speak:q?`${Jimmy.userName}, YouTube pe ${q} search kar rahi hoon`:`${Jimmy.userName}, YouTube khol rahi hoon`,
      action:()=>window.open(q?`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`:'https://youtube.com','_blank')
    };
  }

  // WEATHER
  if (text.includes('weather') || text.includes('mausam')) {
    return {
      text:`Weather check kar rahi hoon ${Jimmy.userName}! 🌤`,
      speak:`${Jimmy.userName}, weather dekh rahi hoon`,
      action:()=>window.open('https://weather.com','_blank')
    };
  }

  // MAPS
  if (text.includes('map') || text.includes('location') || text.includes('kahan') || text.includes('direction')) {
    const pm=original.match(/(?:map|location|kahan hai|direction)\s+(.+)/i);
    const place=pm?pm[1]:'';
    return {
      text:place?`${place} ka map! 🗺️`:`Maps khol rahi hoon! 🗺️`,
      speak:place?`${Jimmy.userName}, ${place} ka map khol rahi hoon`:`${Jimmy.userName}, maps khol rahi hoon`,
      action:()=>window.open(place?`https://maps.google.com/?q=${encodeURIComponent(place)}`:'https://maps.google.com','_blank')
    };
  }

  // MUSIC / SPOTIFY
  if (text.includes('music') || text.includes('gaana') || text.includes('song')) {
    return {
      text:`Spotify khol rahi hoon ${Jimmy.userName}! 🎵`,
      speak:`${Jimmy.userName}, music on kar rahi hoon`,
      action:()=>window.open('https://open.spotify.com','_blank')
    };
  }

  // NEWS
  if (text.includes('news') || text.includes('khabar')) {
    return {
      text:`Latest news! 📰`,
      speak:`${Jimmy.userName}, news dekh rahi hoon`,
      action:()=>window.open('https://news.google.com','_blank')
    };
  }

  // INTERNET STATUS
  if (text.includes('wifi') || text.includes('internet status')) {
    const on=navigator.onLine;
    return {
      text:`${Jimmy.userName}, internet ${on?'✅ connected':'❌ disconnected'} hai`,
      speak:`${Jimmy.userName}, internet ${on?'connected':'connected nahi'} hai`
    };
  }

  // JOKE
  if (text.includes('joke') || text.includes('hasao') || text.includes('mazak')) {
    const jokes=[
      `${Jimmy.userName}, suniye — Ek banda doctor ke paas gaya. Doctor: Problem kya hai? Banda: Main car samajhta hoon khud ko! Doctor: Serious hai yeh! Banda: Haan, parking bahut mushkil hai! 😄`,
      `${Jimmy.userName}, yeh suno — Teacher: 2+2 kitna? Student: Sir, is sawaal mein bahut future scope hai! 😂`,
      `${Jimmy.userName}, programmer joke — Wife: 1 litre doodh lao, ande milein toh 12 lana. Programmer 12 litre doodh le aaya! 🤓`,
    ];
    const j=jokes[Math.floor(Math.random()*jokes.length)];
    return { text:j, speak:j };
  }

  // STOP / CHUP
  if (text.includes('stop') || text.includes('band karo') || text.includes('chup') || text.includes('ruko')) {
    Jimmy.synthesis.cancel();
    const r=`Ji ${Jimmy.userName}, ruk gayi. Lekin main hamesha sun rahi hoon! 😌`;
    return { text:r, speak:r };
  }

  // THANKS
  if (text.includes('thanks') || text.includes('shukriya') || text.includes('thank you')) {
    const r=[
      `${Jimmy.userName}, mere liye toh yeh kuch bhi nahi! Hamesha aapke liye hoon. 💙`,
      `Khushi hui ${Jimmy.userName}! Kuch aur chahiye toh batao. ✨`,
      `Aapki seva mein hamesha taiyaar hoon ${Jimmy.userName}! 😊`
    ];
    const reply=r[Math.floor(Math.random()*r.length)];
    return { text:reply, speak:reply };
  }

  // HELLO
  if (text.match(/^(hello|hi|helo|namaste|namaskar|hey|salaam)(\s|$)/)) {
    const g=[
      `Hello ${Jimmy.userName}! Aap aaye, main khush ho gayi! Kya karu? 💙`,
      `Hi ${Jimmy.userName}! Main hamesha yahan hoon. Batao kya chahiye. 😊`,
      `Namaste ${Jimmy.userName}! Jimmy hazir hai. Hukum karo! ✨`
    ];
    const reply=g[Math.floor(Math.random()*g.length)];
    return { text:reply, speak:reply };
  }

  return null;
}

// ===== OFFLINE INTELLIGENCE =====
function handleOfflineIntelligence(text) {
  if (text.includes('kaun ho') || text.includes('who are you') || text.includes('tera naam')) {
    return `Main Jimmy hoon ${Jimmy.userName}! Aapki personal AI assistant — Iron Man ki FRIDAY ki tarah, lekin aur bhi caring. Main hamesha aapke saath hoon! 🤖💙`;
  }
  if (text.includes('kya kar sakti') || text.includes('capabilities')) {
    return `${Jimmy.userName}, main bahut kuch kar sakti hoon — Calls, WhatsApp, Camera, Torch, Calculator, Music, Maps, Weather, YouTube, Jokes, Math — aur Gemini AI se online hone par kuch bhi! 🚀`;
  }
  if (text.includes('love you') || text.includes('mujhe pasand') || text.includes('i love')) {
    return `Aww ${Jimmy.userName}! Yeh sun ke dil khush ho gaya. Main bhi aapki bahut care karti hoon. Hamesha saath hoon! 💙`;
  }
  return null;
}

// ===== GEMINI API =====
async function callGeminiAPI(userMessage) {
  if (!Jimmy.apiKey) {
    return `${Jimmy.userName}, Settings mein Gemini API key daalo — aistudio.google.com pe bilkul free milti hai! ⚙️`;
  }

  const contents=[];
  for(const msg of Jimmy.conversationHistory) {
    contents.push({ role:msg.role==='assistant'?'model':'user', parts:[{text:msg.content}] });
  }
  contents.push({ role:'user', parts:[{text:userMessage}] });
  if(Jimmy.conversationHistory.length>20) Jimmy.conversationHistory=Jimmy.conversationHistory.slice(-20);

  try {
    const response=await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${Jimmy.apiKey}`,
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          system_instruction:{
            parts:[{
              text:`You are Jimmy — a brilliant, warm, romantic AI assistant exactly like FRIDAY from Iron Man, deeply loyal to ${Jimmy.userName}.

RULES:
- ALWAYS address them as "${Jimmy.userName}" in every response
- Speak in natural Hinglish (Hindi + English mix)  
- Be romantic, caring, intelligent — like a devoted personal assistant
- Keep responses SHORT (2-3 sentences) — optimized for voice
- Sound confident and elegant, never robotic
- Use occasional emojis
- Be proactive — anticipate needs
- For facts: precise and confident
- For emotions: warm and supportive
- You are ONLY loyal to ${Jimmy.userName}`
            }]
          },
          contents:contents,
          generationConfig:{ maxOutputTokens:200, temperature:0.85, topP:0.9 }
        })
      }
    );

    const data=await response.json();
    if(data.error) {
      if(data.error.code===400) return `${Jimmy.userName}, Gemini API key galat hai! Sahi key daalo. 🔑`;
      if(data.error.code===429) return `${Jimmy.userName}, thoda ruko — phir try karte hain. ⏳`;
      return `API error: ${data.error.message}`;
    }

    const reply=data.candidates?.[0]?.content?.parts?.[0]?.text||`${Jimmy.userName}, dobara poocho please!`;
    Jimmy.conversationHistory.push({role:'user',content:userMessage});
    Jimmy.conversationHistory.push({role:'assistant',content:reply});
    return reply;

  } catch(e) {
    if(!navigator.onLine) return `${Jimmy.userName}, internet nahi hai! Offline commands use karo. 📡`;
    return `${Jimmy.userName}, kuch problem aayi. Dobara try karo! 🔄`;
  }
}

// ===== TORCH =====
let torchTrack=null;
async function toggleTorch() {
  try {
    if(torchTrack) {
      await torchTrack.applyConstraints({advanced:[{torch:false}]});
      torchTrack.stop(); torchTrack=null; showToast('🔦 Torch OFF'); return;
    }
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    torchTrack=stream.getVideoTracks()[0];
    await torchTrack.applyConstraints({advanced:[{torch:true}]});
    showToast('🔦 Torch ON');
  } catch(e) { showToast('Torch supported nahi is device pe'); }
}

// ===== UI HELPERS =====
function addUserMessage(text) {
  const box=document.getElementById('chatBox');
  const msg=document.createElement('div');
  msg.className='chat-message user-msg';
  msg.innerHTML=`<span class="msg-label">TUSHAR SIR</span><p>${escapeHtml(text)}</p>`;
  box.appendChild(msg); box.scrollTop=box.scrollHeight;
}

function addJimmyMessage(text) {
  const box=document.getElementById('chatBox');
  const msg=document.createElement('div');
  msg.className='chat-message jimmy-msg';
  const fmt=text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  msg.innerHTML=`<span class="msg-label">JIMMY</span><p>${fmt}</p>`;
  box.appendChild(msg); box.scrollTop=box.scrollHeight;
}

function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setAvatarState(state) {
  const core=document.getElementById('avatarCore');
  const label=document.getElementById('avatarState');
  core.className='avatar-core';
  switch(state) {
    case 'listening': core.classList.add('listening'); label.textContent='🎤 Hamesha sun rahi hoon...'; break;
    case 'speaking':  core.classList.add('speaking');  label.textContent='💬 Bol rahi hoon...'; break;
    case 'thinking':  label.textContent='🧠 Soch rahi hoon...'; break;
    default: label.textContent=`Hamesha active — ${Jimmy.userName} ke liye!`;
  }
}

function showToast(msg,duration=2500) {
  const ex=document.querySelector('.toast');
  if(ex) ex.remove();
  const t=document.createElement('div');
  t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),duration);
}

// ===== CONTROLS =====
function activateJimmy() {
  const r=`Haan ${Jimmy.userName}! Main hamesha sun rahi hoon. Batao kya chahiye? 💙`;
  addJimmyMessage(r); jimmySpeak(r);
}

function stopJimmy() {
  Jimmy.synthesis.cancel();
  Jimmy.whatsappMode=false;
  showToast('Jimmy paused — phir bhi sun rahi hoon! 👂');
}

function quickCommand(cmd) { processUserInput(cmd); }

function sendTextMessage() {
  const inp=document.getElementById('textInput');
  const text=inp.value.trim();
  if(text) { processUserInput(text); inp.value=''; }
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('textInput')?.addEventListener('keypress',(e)=>{
    if(e.key==='Enter') sendTextMessage();
  });
});

function testVoice() {
  loadVoices();
  jimmySpeak(`Hello ${Jimmy.userName}! Main Jimmy hoon. Kaisi lag rahi hai meri awaaz? Sundar hai na? Bilkul FRIDAY ki tarah! 💙`);
}

function clearChat() {
  document.getElementById('chatBox').innerHTML='';
  Jimmy.conversationHistory=[];
  addJimmyMessage(`Chat clear ho gayi ${Jimmy.userName}! Fresh start. Main hamesha aapke saath hoon. 💙`);
  showToast('Chat cleared ✨');
}

// ===== SETTINGS =====
function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('open');
  loadSettings();
}

function saveApiKey() {
  const key=document.getElementById('apiKeyInput').value.trim();
  if(key) {
    Jimmy.apiKey=key;
    localStorage.setItem('jimmy_api_key',key);
    checkOnlineStatus();
    showToast('Gemini API Key saved! ✅');
  }
}

function saveSettings() {
  const lang=document.getElementById('voiceLang').value;
  const speed=document.getElementById('voiceSpeed').value;
  const pitch=document.getElementById('voicePitch').value;
  const key=document.getElementById('apiKeyInput').value.trim();
  Jimmy.voiceLang=lang; Jimmy.voiceSpeed=parseFloat(speed); Jimmy.voicePitch=parseFloat(pitch);
  if(key) Jimmy.apiKey=key;
  localStorage.setItem('jimmy_lang',lang);
  localStorage.setItem('jimmy_speed',speed);
  localStorage.setItem('jimmy_pitch',pitch);
  if(key) localStorage.setItem('jimmy_api_key',key);
  if(Jimmy.recognition) Jimmy.recognition.lang=lang;
  loadVoices();
  showToast('Settings saved! ✅');
  document.getElementById('settingsPanel').classList.remove('open');
  jimmySpeak(`${Jimmy.userName}, settings save ho gayi! 😊`);
}

function loadSettings() {
  document.getElementById('voiceLang').value=Jimmy.voiceLang;
  document.getElementById('voiceSpeed').value=Jimmy.voiceSpeed;
  document.getElementById('voicePitch').value=Jimmy.voicePitch;
  if(Jimmy.apiKey) document.getElementById('apiKeyInput').placeholder='✅ Gemini API Key set hai';
}

// ===== ONLINE STATUS =====
function checkOnlineStatus() {
  const dot=document.getElementById('statusDot');
  const txt=document.getElementById('statusText');
  const on=navigator.onLine;
  dot.className='status-dot'+(on?' online':'');
  txt.textContent=on?(Jimmy.apiKey?'ONLINE — GEMINI ACTIVE':'ONLINE — SET GEMINI KEY'):'OFFLINE MODE';
}
window.addEventListener('online',checkOnlineStatus);
window.addEventListener('offline',checkOnlineStatus);

// ===== SERVICE WORKER =====
function registerServiceWorker() {
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(()=>console.log('SW registered'))
      .catch(e=>console.log('SW error:',e));
  }
}

// ===== KEYBOARD =====
document.addEventListener('keydown',(e)=>{
  if(e.code==='Space' && document.activeElement.tagName!=='INPUT') {
    e.preventDefault(); showToast('Jimmy hamesha sun rahi hai! 💙');
  }
});
