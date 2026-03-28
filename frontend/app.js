const messagesEl = document.getElementById("messages");
const inputEl    = document.getElementById("input");
const welcomeEl  = document.getElementById("welcome-screen");

let voices = [];
let currentUtterance = null;
let isSpeaking = false;

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  const sel = document.getElementById("voice-select");
  if (!sel) return;

  // Filter for English voices
  const engVoices = voices.filter(v => v.lang.startsWith("en"));
  sel.innerHTML = engVoices.length
    ? engVoices.map((v, i) =>
        `<option value="${i}">${v.name.replace(/Microsoft |Google /, "")}</option>`
      ).join("")
    : `<option value="">Default Voice</option>`;
}

window.speechSynthesis.onvoiceschanged = loadVoices;
setTimeout(loadVoices, 500); 

function getSelectedVoice() {
  const sel = document.getElementById("voice-select");
  const idx = sel?.value;
  const engVoices = voices.filter(v => v.lang.startsWith("en"));
  return engVoices[idx] || voices[0] || null;
}


function addMessage(text, sender) {
  // Hide welcome screen on first message
  if (welcomeEl) welcomeEl.style.display = "none";

  const div = document.createElement("div");
  div.classList.add("msg", sender);
  div.innerText = text;
  messagesEl.appendChild(div);
  scrollBottom();
  return div;
}

function addLoadingBubble(label = "Crafting your story") {
  if (welcomeEl) welcomeEl.style.display = "none";
  const div = document.createElement("div");
  div.classList.add("msg", "bot", "loading");
  div.innerHTML = `
    <span>${label}…</span>
    <div class="dots"><span></span><span></span><span></span></div>
  `;
  messagesEl.appendChild(div);
  scrollBottom();
  return div;
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}


function speak(text, bubble) {
  window.speechSynthesis.cancel();
  isSpeaking = true;

  const utter = new SpeechSynthesisUtterance(text);
  currentUtterance = utter;

  const voice = getSelectedVoice();
  if (voice) utter.voice = voice;

  utter.lang  = "en-US";
  utter.rate  = parseFloat(document.getElementById("voice-rate")?.value  || 1);
  utter.pitch = parseFloat(document.getElementById("voice-pitch")?.value || 1);

  const playBtn = bubble?.querySelector(".play-btn");
  const bar     = bubble?.querySelector(".tts-bar");
  const prog    = bubble?.querySelector(".tts-progress");

  if (playBtn) { playBtn.classList.add("active"); playBtn.innerHTML = speakerIcon("pause") + " Pause"; }
  if (bar)     bar.classList.add("active");


  let charCount = 0;
  utter.onboundary = (e) => {
    if (prog && e.charIndex !== undefined) {
      const pct = Math.min(100, (e.charIndex / text.length) * 100);
      prog.style.width = pct + "%";
    }
  };

  utter.onend = () => {
    isSpeaking = false;
    if (playBtn) { playBtn.classList.remove("active"); playBtn.innerHTML = speakerIcon("play") + " Read Aloud"; }
    if (bar)     bar.classList.remove("active");
    if (prog)    prog.style.width = "0%";
  };

  utter.onerror = () => { isSpeaking = false; };

  window.speechSynthesis.speak(utter);
}

function stopVoice() {
  window.speechSynthesis.cancel();
  isSpeaking = false;
  // Reset all play buttons
  document.querySelectorAll(".play-btn").forEach(btn => {
    btn.classList.remove("active");
    btn.innerHTML = speakerIcon("play") + " Read Aloud";
  });
  document.querySelectorAll(".tts-bar").forEach(b => b.classList.remove("active"));
}

function toggleSpeak(btn, text, bubble) {
  if (isSpeaking && btn.classList.contains("active")) {
    stopVoice();
  } else {
    speak(text, bubble);
  }
}

function speakerIcon(type) {
  if (type === "play") return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
}


function buildStoryBubble(storyText, prompt) {
  const div = document.createElement("div");
  div.classList.add("msg", "bot");
  div.dataset.story = storyText;

  div.innerHTML = `
    <div class="story-text">${storyText}</div>
    <div class="story-controls">
      <button class="ctrl-btn play-btn" onclick="toggleSpeak(this, this.closest('.msg').dataset.story, this.closest('.msg'))">
        ${speakerIcon("play")} Read Aloud
      </button>
    </div>
    <div class="tts-bar"><div class="tts-progress"></div></div>
  `;

  messagesEl.appendChild(div);
  scrollBottom();
  return div;
}

async function generateImage(encodedPrompt, parentBubble) {
  const prompt = decodeURIComponent(encodedPrompt);

  const loading = document.createElement("div");
  loading.classList.add("msg", "bot", "loading");
  loading.innerHTML = `
    <span>Painting your scene…</span>
    <div class="dots"><span></span><span></span><span></span></div>
  `;
  messagesEl.appendChild(loading);
  scrollBottom();

  try {
    const res  = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    loading.remove();

    if (data.image) {
      const img = document.createElement("img");
      img.src = data.image;
      img.classList.add("gen-img");
      img.alt = prompt;
      messagesEl.appendChild(img);
      scrollBottom();
    } else {
      const err = document.createElement("div");
      err.classList.add("msg", "bot");
      err.style.color = "var(--muted)";
      err.textContent = "⚠️ Image generation unavailable right now.";
      messagesEl.appendChild(err);
      scrollBottom();
    }
  } catch {
    loading.remove();
  }
}

// Triggered from the Image button in input bar
async function generateImageFromInput() {
  const text = inputEl.value.trim();
  if (!text) return;
  addMessage(text, "user");
  inputEl.value = "";
  generateImage(encodeURIComponent(text), null);
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, "user");
  inputEl.value = "";

  const loading = addLoadingBubble("Crafting your story");

  try {
    const res  = await fetch("/api/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text }),
    });
    const data = await res.json();
    loading.remove();

    const bubble = buildStoryBubble(data.story, text);


    speak(data.story, bubble);

    generateImage(encodeURIComponent(text), bubble);

  } catch {
    loading.remove();
    const err = addMessage("Error connecting to the story server.", "bot");
  }
}

function useChip(el) {
  inputEl.value = el.textContent;
  inputEl.focus();
}

function clearChat() {
  stopVoice();
  messagesEl.innerHTML = `
    <div class="welcome" id="welcome-screen">
      <div class="welcome-icon">📖</div>
      <h2>Tell Me a Story</h2>
      <p>Enter any idea below and I'll weave it into an immersive tale — narrated aloud and illustrated just for you.</p>
      <div class="suggestion-chips">
        <div class="chip" onclick="useChip(this)">a story about a lost astronaut</div>
        <div class="chip" onclick="useChip(this)">a story about a dragon chef</div>
        <div class="chip" onclick="useChip(this)">a story about time travel gone wrong</div>
        <div class="chip" onclick="useChip(this)">a story about an AI that dreams</div>
      </div>
    </div>
  `;
}


inputEl.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
