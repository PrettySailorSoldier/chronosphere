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
  
  // Apply multiplier based on CURRENT user energy setting
  const multiplier = ENERGY_MULTIPLIERS[state.userEnergy];
  const recommendedMinutes = Math.round((pattern.duration / 60) * multiplier);
  
  // Generate detailed productivity tips based on actual time
  let suggestion = '';
  
  // Early Morning (5-7am)
  if (hour >= 5 && hour <= 7) {
    suggestion = `🌅 Morning routine time. Start with ${recommendedMinutes}min planning or light tasks before peak focus`;
  }
  // Morning Peak (8-11am)
  else if (hour >= 8 && hour <= 11) {
    suggestion = `🧠 Peak cognitive time! Tackle complex problems, writing, or coding in ${recommendedMinutes}min blocks`;
  }
  // Lunch Transition (12pm)
  else if (hour === 12) {
    suggestion = `🍽️ Take a proper break. Light ${recommendedMinutes}min tasks only - save deep work for later`;
  }
  // Post-Lunch Dip (1-2pm)
  else if (hour >= 13 && hour <= 14) {
    suggestion = `😴 Natural energy dip. Try ${recommendedMinutes}min of admin tasks, emails, or take a power nap`;
  }
  // Afternoon Recovery (3pm)
  else if (hour === 15) {
    suggestion = `📈 Energy returning. Good for ${recommendedMinutes}min collaborative work or meetings`;
  }
  // Second Wind (4-5pm)
  else if (hour >= 16 && hour <= 17) {
    suggestion = `⚡ Second wind! Great for ${recommendedMinutes}min creative tasks, brainstorming, or finishing projects`;
  }
  // Evening Work (6-7pm)
  else if (hour >= 18 && hour <= 19) {
    suggestion = `🌆 Evening focus. ${recommendedMinutes}min sessions for wrapping up or personal projects`;
  }
  // Evening Wind Down (8-9pm)
  else if (hour >= 20 && hour <= 21) {
    suggestion = `🌙 Winding down. Light ${recommendedMinutes}min tasks - avoid screens if possible`;
  }
  // Pre-Sleep (10-11pm)
  else if (hour >= 22 && hour <= 23) {
    suggestion = `✨ Rest time approaching. Only essential ${recommendedMinutes}min tasks - protect your sleep`;
  }
  // Night Owl (12am-4am)
  else if (hour >= 0 && hour <= 4) {
    suggestion = `🦉 Late night. If you must work, keep to quick ${recommendedMinutes}min sprints with breaks`;
  }
  // Default fallback
  else {
    suggestion = `💡 Try ${recommendedMinutes}min focused sessions based on your current energy`;
  }
  
  document.getElementById('circadianRec').textContent = suggestion;
  
  // Generate suggested task cards based on time and energy
  renderSuggestedTasks(hour, recommendedMinutes);
}

function renderSuggestedTasks(hour, baseMinutes) {
  const container = document.getElementById('suggestedTasks');
  container.innerHTML = '';
  
  // Define task suggestions based on time of day
  let tasks = [];
  
  // Morning (5-11am) - Productive tasks
  if (hour >= 5 && hour <= 11) {
    tasks = [
      { icon: '🧠', name: 'Deep Work', minutes: baseMinutes },
      { icon: '✍️', name: 'Writing', minutes: Math.round(baseMinutes * 0.8) },
      { icon: '📋', name: 'Planning', minutes: Math.round(baseMinutes * 0.5) }
    ];
  }
  // Lunch (12pm) - Light tasks
  else if (hour === 12) {
    tasks = [
      { icon: '📧', name: 'Emails', minutes: 15 },
      { icon: '🚶', name: 'Walk Break', minutes: 10 },
      { icon: '📖', name: 'Reading', minutes: 20 }
    ];
  }
  // Post-lunch dip (1-2pm) - Recovery
  else if (hour >= 13 && hour <= 14) {
    tasks = [
      { icon: '😴', name: 'Power Nap', minutes: 20 },
      { icon: '📧', name: 'Admin Tasks', minutes: baseMinutes },
      { icon: '🎧', name: 'Light Work', minutes: Math.round(baseMinutes * 0.7) }
    ];
  }
  // Afternoon (3-5pm) - Second wind
  else if (hour >= 15 && hour <= 17) {
    tasks = [
      { icon: '💡', name: 'Creative Work', minutes: baseMinutes },
      { icon: '🤝', name: 'Collaboration', minutes: 30 },
      { icon: '🎯', name: 'Finish Tasks', minutes: Math.round(baseMinutes * 0.6) }
    ];
  }
  // Evening (6-9pm) - Wind down
  else if (hour >= 18 && hour <= 21) {
    tasks = [
      { icon: '📝', name: 'Review Day', minutes: 15 },
      { icon: '📚', name: 'Learning', minutes: baseMinutes },
      { icon: '🧘', name: 'Mindfulness', minutes: 10 }
    ];
  }
  // Night (10pm-4am) - Rest focused
  else {
    tasks = [
      { icon: '📖', name: 'Light Reading', minutes: 15 },
      { icon: '🧘', name: 'Relax', minutes: 10 },
      { icon: '✨', name: 'Quick Task', minutes: Math.round(baseMinutes * 0.5) }
    ];
  }
  
  // Render task cards
  tasks.forEach(task => {
    const card = document.createElement('button');
    card.className = 'suggested-task';
    card.innerHTML = `
      <span class="task-icon">${task.icon}</span>
      <span class="task-name">${task.name}</span>
      <span class="task-time">${task.minutes}m</span>
    `;
    card.addEventListener('click', () => {
      createTimer(task.minutes, task.name);
    });
    container.appendChild(card);
  });
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
          source: `sounds/${state.sound}.wav`,
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
  // If specific Pomodoro button
  if (name === 'Pomodoro') {
      chrome.runtime.sendMessage({ type: 'startPomodoro' });
      return;
  }

  const id = Date.now().toString();
  const endTime = Date.now() + (minutes * 60 * 1000);
  
  const timer = {
    id,
    name,
    endTime,
    originalMinutes: minutes,
    duration: minutes,
    type: 'focus', // default
    status: 'running'
  };
  
  // Optimistic UI update
  updateTimerList(); // Will fetch from storage anyway
  
  chrome.runtime.sendMessage({ 
    type: 'createAlarm', 
    timer: timer 
  });
}

function updateTimerList() {
  chrome.storage.local.get(['timers'], (data) => {
    const list = document.getElementById('activeTimers');
    list.innerHTML = '';
    
    if (data.timers && data.timers.length > 0) {
      data.timers.forEach(timer => {
        const el = document.createElement('div');
        el.className = 'glass-card active-timer-card';
        
        let timeLeft = 0;
        let progress = 0;
        let endTimeStr = '';
        
        if (timer.status === 'paused') {
             timeLeft = timer.remainingMs || 0;
             // Calculate hypothetical end time if resumed now
             const endD = new Date(Date.now() + timeLeft);
             endTimeStr = endD.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } else {
             const now = Date.now();
             timeLeft = Math.max(0, timer.endTime - now);
             const endD = new Date(timer.endTime);
             endTimeStr = endD.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }

        const minutesVal = timer.originalMinutes || (timer.duration ? timer.duration / 60 : 25);
        const totalMs = minutesVal * 60 * 1000;
        
        if (totalMs > 0) {
            progress = ((totalMs - timeLeft) / totalMs) * 100;
        } else {
            progress = 0;
        }
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        // Circular Progress Calculation
        const radius = 50;
        // Limit progress to 0-100
        const clampedProgress = Math.min(100, Math.max(0, progress));
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (clampedProgress / 100) * circumference;
        
        // Pause/Resume Button
        const pauseBtnIcon = timer.status === 'paused' ? '▶️' : '⏸️';
        const pauseBtnAction = timer.status === 'paused' ? 'resumeTimer' : 'pauseTimer';

        el.innerHTML = `
          <div class="timer-circle-wrapper">
            <svg class="timer-svg" width="120" height="120">
               <circle class="timer-bg" cx="60" cy="60" r="${radius}"></circle>
               <circle class="timer-progress" cx="60" cy="60" r="${radius}" 
                       stroke-dasharray="${circumference}" 
                       stroke-dashoffset="${offset}"></circle>
            </svg>
            <div class="timer-text-overlay">
                <div class="timer-time">${minutes}:${seconds.toString().padStart(2, '0')}</div>
            </div>
          </div>
          
          <div class="timer-info">
            <h3 class="timer-title">${timer.name}</h3>
            <div class="timer-meta">
               <span>🔔 Ends at ${endTimeStr}</span>
            </div>
            
            <div class="timer-controls">
                <button class="icon-btn ${pauseBtnAction}" data-id="${timer.id}">${pauseBtnIcon}</button>
                <button class="icon-btn stop-btn" data-id="${timer.id}">⏹️</button>
            </div>
          </div>
        `;
        
        // Event Listeners for buttons
        el.querySelector(`.${pauseBtnAction}`).addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: pauseBtnAction, id: timer.id });
            setTimeout(updateTimerList, 100); // Quick refresh
        });
        
        el.querySelector('.stop-btn').addEventListener('click', () => {
            stopTimer(timer.id);
        });

        list.appendChild(el);
      });
    }
  });
}

function stopTimer(id) {
  chrome.runtime.sendMessage({ type: 'stopTimer', id });
  // Remove element immediately for responsiveness
  setTimeout(updateTimerList, 100);
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
// STATS (Removed from UI but kept in storage for future use)
// ═══════════════════════════════════════════════════

function initStats() {
    // Stats UI removed to save space
    // Data still tracked in background for potential future features
    // document.getElementById('dailyCount').textContent = state.stats.dailyCount;
    // const h = Math.floor(state.stats.focusTime / 60);
    // const m = state.stats.focusTime % 60;
    // document.getElementById('focusTime').textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
    // document.getElementById('streak').textContent = state.stats.streak;
}

// ═══════════════════════════════════════════════════
// TAB FREEZE UI
// ═══════════════════════════════════════════════════

function initTabFreeze() {
    // Tab Freeze Toggle
    const toggleInput = document.getElementById('tabFreezeEnabled');
    
    // Load saved state
    chrome.storage.local.get(['freezeEnabled'], (res) => {
        toggleInput.checked = res.freezeEnabled !== false; // Default true
    });
    
    // Save on change
    toggleInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ freezeEnabled: e.target.checked });
    });
    
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
