/* ═══════════════════════════════════════════════════
   CHRONO SPHERE - POPUP LOGIC
   ═══════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════
// CIRCADIAN CONSTANTS
// ═══════════════════════════════════════════════════

const CIRCADIAN_PATTERNS = {
  0: { energy: 'low', duration: 1500, icon: '🌙', msg: 'Late night winding down' },
  1: { energy: 'low', duration: 1500, icon: '🌙', msg: 'Rest recommended' },
  2: { energy: 'low', duration: 1500, icon: '😴', msg: 'Deep rest time' },
  3: { energy: 'low', duration: 1500, icon: '😴', msg: 'Deep rest time' },
  4: { energy: 'low', duration: 1500, icon: '😴', msg: 'Early morning quiet' },
  5: { energy: 'medium', duration: 1800, icon: '🌅', msg: 'Waking up' },
  6: { energy: 'medium', duration: 2400, icon: '🌅', msg: 'Morning routing' },
  7: { energy: 'high', duration: 3120, icon: '⚡', msg: 'Morning surge' },
  8: { energy: 'high', duration: 3120, icon: '⚡', msg: 'Morning surge' },
  9: { energy: 'high', duration: 3120, icon: '🎯', msg: 'Peak focus window' },
  10: { energy: 'high', duration: 3120, icon: '🎯', msg: 'Peak focus window' },
  11: { energy: 'high', duration: 3120, icon: '🎯', msg: 'Peak focus window' },
  12: { energy: 'medium', duration: 2400, icon: '🍽️', msg: 'Lunch transition' },
  13: { energy: 'low', duration: 1500, icon: '😴', msg: 'Post-lunch dip' },
  14: { energy: 'low', duration: 1500, icon: '😴', msg: 'Post-lunch dip' },
  15: { energy: 'medium', duration: 2400, icon: '📈', msg: 'Afternoon recovery' },
  16: { energy: 'high', duration: 2700, icon: '⚡', msg: 'Second wind' },
  17: { energy: 'high', duration: 2700, icon: '⚡', msg: 'Second wind' },
  18: { energy: 'medium', duration: 1800, icon: '🌆', msg: 'Evening work' },
  19: { energy: 'medium', duration: 1800, icon: '🌆', msg: 'Evening work' },
  20: { energy: 'medium', duration: 2700, icon: '🌙', msg: 'Evening focus' },
  21: { energy: 'medium', duration: 1800, icon: '🌙', msg: 'Winding down' },
  22: { energy: 'low', duration: 1500, icon: '✨', msg: 'Prepare for sleep' },
  23: { energy: 'low', duration: 1500, icon: '✨', msg: 'Prepare for sleep' }
};

const ENERGY_MULTIPLIERS = {
  high: 1.2,    // Energize
  medium: 1.0,  // Balanced
  low: 0.7      // Relax
};

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════

let state = {
  timers: [],
  userEnergy: 'medium', // low, medium, high
  stats: {
    dailyCount: 0,
    focusTime: 0,
    streak: 0
  },
  sound: 'chime',
  volume: 0.8
};

// ═══════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initCircadian();
  initEventListeners();
  initStats();
  initTabFreeze();
  startUpdateLoop();
});

async function loadState() {
  const data = await chrome.storage.local.get(['timers', 'userEnergy', 'stats', 'sound', 'volume']);
  if (data.timers) state.timers = data.timers;
  if (data.userEnergy) state.userEnergy = data.userEnergy;
  if (data.stats) state.stats = data.stats;
  if (data.sound) state.sound = data.sound;
  if (data.volume) state.volume = data.volume;
  
  // UI Sync
  updateTimerList();
  
  // Settings sync
  document.getElementById('soundSelect').value = state.sound;
  document.getElementById('volumeControl').value = state.volume * 100;
  
  // Energy Slider Sync
  const sliderDetail = {'low': 1, 'medium': 2, 'high': 3};
  document.getElementById('energySlider').value = sliderDetail[state.userEnergy] || 2;
  updateEnergyPills(state.userEnergy);
}

// ═══════════════════════════════════════════════════
// CIRCADIAN LOGIC
// ═══════════════════════════════════════════════════

function initCircadian() {
  updateCircadianRec();
  setInterval(updateCircadianRec, 60000 * 30); // Update every 30 mins
}

function updateCircadianRec() {
  const hour = new Date().getHours();
  const pattern = CIRCADIAN_PATTERNS[hour];
  
  // Update Header Indicator
  document.getElementById('circadianIcon').textContent = pattern.icon;
  document.getElementById('circadianLabel').textContent = pattern.msg;
  
  // Update Recommendation Text
  // Apply multiplier based on CURRENT user energy setting
  const multiplier = ENERGY_MULTIPLIERS[state.userEnergy];
  const recommendedMinutes = Math.round((pattern.duration / 60) * multiplier);
  
  document.getElementById('circadianRec').textContent = 
    `Try ${recommendedMinutes} min sessions now (${pattern.msg.toLowerCase()})`;
}

// ═══════════════════════════════════════════════════
// NLP PARSER
// ═══════════════════════════════════════════════════

function parseTimerPhrase(input) {
  input = input.toLowerCase();
  let minutes = 25; // default
  let name = "Focus";
  
  // 1. Check Presets
  if (input.includes('pomodoro')) return { minutes: 25, name: 'Pomodoro' };
  if (input.includes('short break')) return { minutes: 5, name: 'Short Break' };
  if (input.includes('long break')) return { minutes: 15, name: 'Long Break' };
  if (input.includes('deep work')) return { minutes: 52, name: 'Deep Work' };
  
  // 2. Parse explicit time "30 minutes", "45 mins", "1 hour"
  const timeRegex = /(\d+)\s*(m|min|minute|minutes|h|hour|hours)/;
  const match = input.match(timeRegex);
  
  if (match) {
    const val = parseInt(match[1]);
    const unit = match[2];
    if (unit.startsWith('h')) {
      minutes = val * 60;
    } else {
      minutes = val;
    }
  }
  
  // 3. Extract Name context
  if (input.includes('study')) name = 'Study';
  else if (input.includes('read')) name = 'Reading';
  else if (input.includes('code') || input.includes('coding')) name = 'Coding';
  else if (input.includes('workout') || input.includes('exercise')) name = 'Workout';
  else if (input.includes('meditate')) name = 'Meditation';
  else if (input.includes('meeting')) name = 'Meeting';
  
  return { minutes, name };
}

// ═══════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════

function initEventListeners() {
  // Energy Slider
  const slider = document.getElementById('energySlider');
  slider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    const map = { 1: 'low', 2: 'medium', 3: 'high' };
    setEnergyLevel(map[val]);
  });
  
  // Preset Pills
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      setEnergyLevel(pill.dataset.energy);
      // Sync slider
      const mapVal = { 'low': 1, 'medium': 2, 'high': 3 };
      slider.value = mapVal[pill.dataset.energy];
    });
  });
  
  // Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const baseMinutes = parseInt(btn.dataset.minutes);
      const name = btn.dataset.name;
      // Apply Energy Multiplier
      const multiplier = ENERGY_MULTIPLIERS[state.userEnergy];
      const finalMinutes = Math.round(baseMinutes * multiplier);
      
      createTimer(finalMinutes, name);
    });
  });
  
  // NLP Input
  const quickInput = document.getElementById('quickTimerInput');
  const createBtn = document.getElementById('quickCreateBtn');
  
  createBtn.addEventListener('click', () => {
    if(!quickInput.value) return;
    const parsed = parseTimerPhrase(quickInput.value);
    createTimer(parsed.minutes, parsed.name);
    quickInput.value = '';
  });
  
  quickInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createBtn.click();
  });
  
  // Settings
  document.getElementById('soundSelect').addEventListener('change', (e) => {
    state.sound = e.target.value;
    saveState();
  });
  
  document.getElementById('volumeControl').addEventListener('input', (e) => {
      state.volume = parseInt(e.target.value) / 100;
      saveState();
  });

  document.getElementById('previewSoundBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({
          type: 'playSound',
          source: `sounds/${state.sound}.mp3`,
          volume: state.volume
      });
  });

}

function setEnergyLevel(level) {
  state.userEnergy = level;
  updateEnergyPills(level);
  updateCircadianRec();
  saveState();
}

function updateEnergyPills(activeLevel) {
  document.querySelectorAll('.preset-pill').forEach(pill => {
    if (pill.dataset.energy === activeLevel) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

// ═══════════════════════════════════════════════════
// TIMER LOGIC
// ═══════════════════════════════════════════════════

function createTimer(minutes, name) {
  const id = Date.now().toString();
  const durationSec = minutes * 60;
  const endTime = Date.now() + (durationSec * 1000);
  
  const timer = {
    id,
    name,
    duration: durationSec,
    endTime,
    status: 'running',
    originalMinutes: minutes
  };
  
  state.timers.push(timer);
  saveState();
  updateTimerList();
  
  // Send to background to create alarm
  chrome.runtime.sendMessage({ type: 'createAlarm', timer });
}

function updateTimerList() {
  const container = document.getElementById('activeTimers');
  container.innerHTML = '';
  
  state.timers.forEach(timer => {
    const remaining = Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Create Timer Card
    const el = document.createElement('div');
    el.className = 'glass-card timer-card';
    el.innerHTML = `
      <div class="timer-name">${timer.name}</div>
      <div class="timer-display">${timeStr}</div>
      <div style="display:flex; justify-content:center; gap:10px;">
        <button class="glass-button" style="padding: 8px 16px; font-size:12px;" onclick="stopTimer('${timer.id}')">Stop</button>
      </div>
    `;
    
    // Attach event listener for stop manually (since onclick undefined in extension string)
    el.querySelector('button').addEventListener('click', () => stopTimer(timer.id));
    
    container.appendChild(el);
  });
}

async function stopTimer(id) {
    const timer = state.timers.find(t => t.id === id);
    if(timer) {
        state.timers = state.timers.filter(t => t.id !== id);
        await saveState();
        updateTimerList();
        
        // Notify background
        chrome.runtime.sendMessage({ type: 'stopTimer', id });
        
        // Log incomplete?
    }
}

async function saveState() {
  await chrome.storage.local.set({
    timers: state.timers,
    userEnergy: state.userEnergy,
    sound: state.sound,
    volume: state.volume
  });
}

function startUpdateLoop() {
  setInterval(() => {
    // Only update UI if timers are running
    if (state.timers.length > 0) {
       updateTimerList();
    }
  }, 1000);
}

// ═══════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════

function initStats() {
    document.getElementById('dailyCount').textContent = state.stats.dailyCount;
    // Format focus time
    const h = Math.floor(state.stats.focusTime / 60);
    const m = state.stats.focusTime % 60;
    document.getElementById('focusTime').textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
    document.getElementById('streak').textContent = state.stats.streak;
}

// ═══════════════════════════════════════════════════
// TAB FREEZE UI
// ═══════════════════════════════════════════════════

function initTabFreeze() {
    const addBtn = document.getElementById('addWhitelistBtn');
    addBtn.addEventListener('click', () => {
        const domain = prompt("Enter domain to whitelist (e.g. spotify.com):");
        if(domain) {
            // Send to background or handle locally
            // We need to message background or reuse TabFreezeManager logic via IPC if possible, 
            // but we can just update storage directly since TabFreezeManager reads storage.
             chrome.storage.local.get(['freezeWhitelist'], (res) => {
                 const list = res.freezeWhitelist || [];
                 if(!list.includes(domain)) {
                     list.push(domain);
                     chrome.storage.local.set({freezeWhitelist: list}, renderWhitelist);
                 }
             });
        }
    });
    
    // Initial Render
    chrome.storage.local.get(['freezeWhitelist'], (res) => {
        // Pre-populate if empty (defaults are in class, but we need to ensure storage matches)
         if(!res.freezeWhitelist) {
             const defaults = ['gmail.com', 'spotify.com', 'notion.so', 'youtube.com', 'meet.google.com'];
             chrome.storage.local.set({freezeWhitelist: defaults}, renderWhitelist);
         } else {
             renderWhitelist();
         }
    });
}

function renderWhitelist() {
    chrome.storage.local.get(['freezeWhitelist'], (res) => {
        const list = res.freezeWhitelist || [];
        const box = document.getElementById('whitelistBox');
        // Clear old chips except ADD button
        const addBtn = document.getElementById('addWhitelistBtn');
        box.innerHTML = '';
        
        list.forEach(domain => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerHTML = `
                ${domain}
                <span class="chip-remove">×</span>
            `;
            chip.querySelector('.chip-remove').addEventListener('click', () => {
                const newList = list.filter(d => d !== domain);
                chrome.storage.local.set({freezeWhitelist: newList}, renderWhitelist);
            });
            box.appendChild(chip);
        });
        
        box.appendChild(addBtn);
    });
}
