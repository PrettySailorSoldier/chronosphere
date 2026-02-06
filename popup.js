let timers = [];

// ═══════════════════════════════════════════════════
// CIRCADIAN RHYTHM CONSTANTS
// ═══════════════════════════════════════════════════

const CIRCADIAN_PATTERNS = {
  0: { energy: 'low', duration: 1500, icon: '🌙', msg: 'Late night winding down' },
  1: { energy: 'low', duration: 1500, icon: '🌙', msg: 'Rest recommended' },
  2: { energy: 'low', duration: 1500, icon: '😴', msg: 'Deep rest time' },
  3: { energy: 'low', duration: 1500, icon: '😴', msg: 'Deep rest time' },
  4: { energy: 'low', duration: 1500, icon: '😴', msg: 'Early morning quiet' },
  5: { energy: 'medium', duration: 1800, icon: '🌅', msg: 'Waking up' },
  6: { energy: 'medium', duration: 2400, icon: '🌅', msg: 'Morning routine' },
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

let userEnergy = 'medium'; // User's current energy setting

// Step type display names
const STEP_LABELS = {
  pomodoro: '🍅 Pomodoro',
  shortBreak: '☕ Short Break',
  longBreak: '🌙 Long Break',
  deepWork: '🎯 Deep Work'
};

// Load timers on popup open
document.addEventListener('DOMContentLoaded', async () => {
  await loadTimers();
  await loadHistory();
  await loadStats();
  await loadSequences();
  await loadActiveSequence();
  await loadCustomSounds();
  setupEventListeners();
  
  // Initialize Circadian Rhythm feature
  initCircadian();

  // Refresh timer displays every second
  setInterval(updateAllTimerDisplays, 1000);
});

function setupEventListeners() {
  document.getElementById('startBtn').addEventListener('click', createTimer);
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    window.location.href = 'settings.html';
  });

  // Stats button
  document.getElementById('statsBtn').addEventListener('click', () => {
    window.location.href = 'stats.html';
  });

  // Preset buttons - load custom times from settings
  loadPresetTimes();
  
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const presetName = btn.dataset.name;
      const minutes = await getPresetMinutes(presetName);
      createPresetTimer(minutes, presetName);
    });
  });
  
  document.getElementById('soundSelect').addEventListener('change', (e) => {
    const customSoundInput = document.getElementById('customSound');
    if (e.target.value === 'custom') {
      customSoundInput.style.display = 'block';
      customSoundInput.click();
    } else {
      customSoundInput.style.display = 'none';
    }
  });

  document.getElementById('customSound').addEventListener('change', handleCustomSound);

  // History toggle
  document.getElementById('historyToggle').addEventListener('click', toggleHistory);

  // History item click (delegated)
  document.getElementById('historyList').addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (item) {
      const name = item.dataset.name;
      const duration = parseInt(item.dataset.duration);
      if (name && duration) {
        reviveTimer(name, duration);
      }
    }
  });

  // Sequences
  document.getElementById('startSequenceBtn').addEventListener('click', startSequence);
}

// Load custom preset times from settings
async function loadPresetTimes() {
  const result = await chrome.storage.local.get(['settings']);
  const settings = result.settings;
  
  if (settings && settings.presets) {
    const presetMap = {
      'Pomodoro': settings.presets.pomodoro,
      'Short Break': settings.presets.shortBreak,
      'Long Break': settings.presets.longBreak,
      'Deep Work': settings.presets.deepWork
    };
    
    document.querySelectorAll('.preset-btn').forEach(btn => {
      const name = btn.dataset.name;
      if (presetMap[name]) {
        btn.dataset.minutes = presetMap[name];
        const timeSpan = btn.querySelector('.preset-time');
        if (timeSpan) {
          timeSpan.textContent = `${presetMap[name]}min`;
        }
      }
    });
  }
}

async function getPresetMinutes(presetName) {
  const result = await chrome.storage.local.get(['settings']);
  const settings = result.settings;
  
  const defaultTimes = {
    'Pomodoro': 25,
    'Short Break': 5,
    'Long Break': 15,
    'Deep Work': 52
  };
  
  if (settings && settings.presets) {
    const presetMap = {
      'Pomodoro': settings.presets.pomodoro,
      'Short Break': settings.presets.shortBreak,
      'Long Break': settings.presets.longBreak,
      'Deep Work': settings.presets.deepWork
    };
    return presetMap[presetName] || defaultTimes[presetName];
  }
  
  return defaultTimes[presetName];
}

async function loadTimers() {
  try {
    const result = await chrome.storage.local.get(['timers']);
    timers = result.timers || [];
    renderTimers();
  } catch (err) {
    console.error('Failed to load timers:', err);
    timers = [];
    renderTimers();
  }
}

async function saveTimers() {
  try {
    await chrome.storage.local.set({ timers });
  } catch (err) {
    console.error('Failed to save timers:', err);
    showAlert('Failed to save timer');
  }
}

function createPresetTimer(minutes, name) {
  const totalSeconds = minutes * 60;
  const notificationMsg = document.getElementById('notificationMsg').value || `${name} complete! ✨`;
  
  const timer = {
    id: Date.now().toString(),
    name,
    totalSeconds,
    remainingSeconds: totalSeconds,
    endTime: Date.now() + (totalSeconds * 1000),
    soundType: document.getElementById('soundSelect').value,
    notificationMsg,
    isRunning: true
  };

  timers.push(timer);
  saveTimers();
  
  // Tell background script to create alarm
  chrome.runtime.sendMessage({
    action: 'createTimer',
    timer: timer
  });

  renderTimers();
}

// Maximum timer duration: 24 hours
const MAX_TIMER_SECONDS = 24 * 60 * 60;

function createTimer() {
  const hours = parseInt(document.getElementById('hours').value) || 0;
  const minutes = parseInt(document.getElementById('minutes').value) || 0;
  const seconds = parseInt(document.getElementById('seconds').value) || 0;
  const name = document.getElementById('timerName').value.trim() || 'Custom Timer';
  const notificationMsg = document.getElementById('notificationMsg').value.trim() || 'Time\'s up! ✨';

  // Input validation
  if (hours < 0 || minutes < 0 || seconds < 0) {
    showAlert('Timer values cannot be negative');
    return;
  }

  if (hours > 24 || minutes > 59 || seconds > 59) {
    showAlert('Invalid time: max 24h, 59m, 59s');
    return;
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  if (totalSeconds === 0) {
    showAlert('Please set a time greater than 0');
    return;
  }

  if (totalSeconds > MAX_TIMER_SECONDS) {
    showAlert('Timer cannot exceed 24 hours');
    return;
  }

  const timer = {
    id: Date.now().toString(),
    name,
    totalSeconds,
    remainingSeconds: totalSeconds,
    endTime: Date.now() + (totalSeconds * 1000),
    soundType: document.getElementById('soundSelect').value,
    notificationMsg,
    isRunning: true
  };

  timers.push(timer);
  saveTimers();
  
  // Tell background script to create alarm
  chrome.runtime.sendMessage({
    action: 'createTimer',
    timer: timer
  });

  // Clear inputs
  document.getElementById('hours').value = '';
  document.getElementById('minutes').value = '';
  document.getElementById('seconds').value = '';
  document.getElementById('timerName').value = '';
  
  renderTimers();
}

function reviveTimer(name, totalSeconds) {
  // Check if we need to decode HTML entities in name since it was escaped in dataset
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = name;
  const decodedName = tempDiv.textContent;

  const notificationMsg = document.getElementById('notificationMsg').value || `${decodedName} complete! ✨`;
  
  const timer = {
    id: Date.now().toString(),
    name: decodedName,
    totalSeconds,
    remainingSeconds: totalSeconds,
    endTime: Date.now() + (totalSeconds * 1000),
    soundType: document.getElementById('soundSelect').value,
    notificationMsg,
    isRunning: true
  };

  timers.push(timer);
  saveTimers();
  
  // Tell background script to create alarm
  chrome.runtime.sendMessage({
    action: 'createTimer',
    timer: timer
  });

  renderTimers();
  
  // Visual feedback
  showAlert(`Restarted: ${decodedName}`);
  
  // Scroll to top to see active timers
  document.getElementById('timersList').scrollIntoView({ behavior: 'smooth' });
}

function renderTimers() {
  const container = document.getElementById('timersList');
  
  if (timers.length === 0) {
    container.innerHTML = '<div class="empty-state">No active timers<br>Start one above! 🌸</div>';
    return;
  }

  container.innerHTML = timers.map(timer => {
    const progress = timer.totalSeconds > 0 ? timer.remainingSeconds / timer.totalSeconds : 0;
    const circumference = 2 * Math.PI * 45; // radius = 45
    const dashOffset = circumference * (1 - progress);
    const endTimeDisplay = timer.isRunning ? formatEndTime(timer.endTime) : 'Paused';
    
    return `
    <div class="timer-card" data-id="${timer.id}">
      <div class="timer-header">
        <span class="timer-name">${escapeHtml(timer.name)}</span>
        <span class="timer-end-time" data-id="${timer.id}">⏰ ${endTimeDisplay}</span>
      </div>
      <div class="timer-progress-wrapper">
        <svg class="progress-ring" width="120" height="120">
          <defs>
            <linearGradient id="progressGradient-${timer.id}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#9b87f5;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#ff69b4;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#ff8c42;stop-opacity:1" />
            </linearGradient>
          </defs>
          <circle class="progress-ring-bg" cx="60" cy="60" r="45"></circle>
          <circle 
            class="progress-ring-fill" 
            cx="60" 
            cy="60" 
            r="45"
            stroke="url(#progressGradient-${timer.id})"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            data-id="${timer.id}"
            data-circumference="${circumference}"
          ></circle>
        </svg>
        <div class="timer-display-overlay" data-id="${timer.id}">
          ${formatTime(timer.remainingSeconds)}
        </div>
      </div>
      <div class="timer-actions">
        <button class="pause-btn" data-id="${timer.id}">${timer.isRunning ? '⏸ Pause' : '▶️ Resume'}</button>
        <button class="delete-btn" data-id="${timer.id}">🗑</button>
      </div>
    </div>
  `;
  }).join('');

  // Attach event listeners after rendering
  document.querySelectorAll('.pause-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const timerId = e.target.dataset.id;
      pauseTimer(timerId);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const timerId = e.target.dataset.id;
      deleteTimer(timerId);
    });
  });


}

async function snoozeTimerPopup(timerId, minutes) {
  const timer = timers.find(t => t.id === timerId);
  if (!timer) return;

  // Cancel existing alarm
  chrome.runtime.sendMessage({
    action: 'cancelTimer',
    timerId: timerId
  });

  // Update timer with snooze time
  const snoozeSeconds = minutes * 60;
  timer.remainingSeconds = snoozeSeconds;
  timer.totalSeconds = snoozeSeconds;
  timer.endTime = Date.now() + (snoozeSeconds * 1000);
  timer.isRunning = true;
  if (!timer.name.includes('(Snooze)')) {
    timer.name = `${timer.name} (Snooze)`;
  }

  await saveTimers();

  // Create new alarm
  chrome.runtime.sendMessage({
    action: 'createTimer',
    timer: timer
  });

  showAlert(`Snoozed for ${minutes} min 😴`);
  renderTimers();
}

function pauseTimer(timerId) {
  const timer = timers.find(t => t.id === timerId);
  if (!timer) return;
  
  timer.isRunning = !timer.isRunning;
  
  if (timer.isRunning) {
    timer.endTime = Date.now() + (timer.remainingSeconds * 1000);
    chrome.runtime.sendMessage({
      action: 'createTimer',
      timer: timer
    });
  } else {
    chrome.runtime.sendMessage({
      action: 'cancelTimer',
      timerId: timerId
    });
  }
  
  saveTimers();
  renderTimers();
}

function deleteTimer(timerId) {
  timers = timers.filter(t => t.id !== timerId);
  chrome.runtime.sendMessage({
    action: 'cancelTimer',
    timerId: timerId
  });
  saveTimers();
  renderTimers();
}

// Maximum custom audio file size: 5MB
const MAX_AUDIO_SIZE_MB = 5;
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const MAX_CUSTOM_SOUNDS = 10;

// Load custom sounds into the dropdown
async function loadCustomSounds() {
  try {
    const result = await chrome.storage.local.get(['customSounds']);
    const customSounds = result.customSounds || [];

    const select = document.getElementById('soundSelect');

    // Remove existing custom sound options (keep built-in ones)
    const existingCustomOptions = select.querySelectorAll('option[data-custom="true"]');
    existingCustomOptions.forEach(opt => opt.remove());

    // Add custom sounds before the "Upload Custom" option
    const uploadOption = select.querySelector('option[value="custom"]');

    customSounds.forEach(sound => {
      const option = document.createElement('option');
      option.value = `custom_${sound.id}`;
      option.textContent = `🎵 ${sound.name}`;
      option.dataset.custom = 'true';
      select.insertBefore(option, uploadOption);
    });
  } catch (err) {
    console.error('Failed to load custom sounds:', err);
  }
}

async function handleCustomSound(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file size
  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    showAlert(`File too large! Max size is ${MAX_AUDIO_SIZE_MB}MB`);
    event.target.value = ''; // Clear the input
    return;
  }

  // Validate file type
  if (!file.type.startsWith('audio/')) {
    showAlert('Please select an audio file');
    event.target.value = '';
    return;
  }

  // Check limit
  const existing = await chrome.storage.local.get(['customSounds']);
  const customSounds = existing.customSounds || [];

  if (customSounds.length >= MAX_CUSTOM_SOUNDS) {
    showAlert(`Max ${MAX_CUSTOM_SOUNDS} custom sounds. Delete one first.`);
    event.target.value = '';
    return;
  }

  // Get name from filename (remove extension)
  const fileName = file.name.replace(/\.[^/.]+$/, '');
  const soundName = fileName.slice(0, 30); // Limit name length

  const reader = new FileReader();
  reader.onload = async (e) => {
    const audioData = e.target.result;

    // Create new custom sound entry
    const newSound = {
      id: Date.now().toString(),
      name: soundName,
      data: audioData,
      createdAt: Date.now()
    };

    customSounds.push(newSound);

    try {
      await chrome.storage.local.set({ customSounds });
      showAlert(`Sound "${soundName}" saved! 🎵`);

      // Reload the dropdown and select the new sound
      await loadCustomSounds();
      document.getElementById('soundSelect').value = `custom_${newSound.id}`;
    } catch (err) {
      console.error('Failed to save custom audio:', err);
      showAlert('Failed to save audio. Try a smaller file.');
    }
  };
  reader.onerror = () => {
    showAlert('Failed to read audio file');
  };
  reader.readAsDataURL(file);
  event.target.value = ''; // Reset input for next upload
}

function showAlert(message) {
  // Simple visual feedback - you could make this prettier
  const alertDiv = document.createElement('div');
  alertDiv.textContent = message;
  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, var(--periwinkle), var(--bright-pink));
    color: white;
    padding: 12px 24px;
    border-radius: 10px;
    z-index: 1000;
    animation: slideDown 0.3s ease;
  `;
  document.body.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 3000);
}

// History Functions
async function loadHistory() {
  try {
    const result = await chrome.storage.local.get(['history']);
    const history = result.history || [];

    const historyList = document.getElementById('historyList');

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state" style="padding: 15px;">No completed timers yet</div>';
      return;
    }

    // Show last 10 entries, most recent first
    const recentHistory = history.slice(-10).reverse();

    historyList.innerHTML = recentHistory.map(item => {
      const date = new Date(item.completedAt);
      const timeAgo = getTimeAgo(date);
      const duration = formatDuration(item.duration);

      return `
        <div class="history-item" data-name="${escapeHtml(item.name)}" data-duration="${item.duration}" title="Click to restart '${item.name}'">
          <div>
            <div class="history-name">${escapeHtml(item.name)}</div>
            <div class="history-date">${timeAgo}</div>
          </div>
          <div class="history-time">${duration}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['history', 'stats']);
    const history = result.history || [];
    const stats = result.stats || { lastActiveDate: null, streak: 0 };

    // Calculate today's stats
    const today = new Date().toDateString();
    const todayHistory = history.filter(item =>
      new Date(item.completedAt).toDateString() === today
    );

    const todayCount = todayHistory.length;
    const todayMinutes = Math.round(todayHistory.reduce((sum, item) => sum + item.duration, 0) / 60);

    // Update streak
    let streak = stats.streak || 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (stats.lastActiveDate === today) {
      // Already active today, keep streak
    } else if (stats.lastActiveDate === yesterday.toDateString()) {
      // Was active yesterday, streak continues if active today
      if (todayCount > 0) {
        streak++;
      }
    } else if (todayCount > 0) {
      // First activity after a gap, reset streak
      streak = 1;
    }

    // Update stats in storage if there's activity today
    if (todayCount > 0 && stats.lastActiveDate !== today) {
      await chrome.storage.local.set({
        stats: { lastActiveDate: today, streak }
      }).catch(err => console.error('Failed to save stats:', err));
    }

    // Update UI
    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('todayMinutes').textContent = todayMinutes + 'm';
    document.getElementById('streakCount').textContent = streak;
  } catch (err) {
    console.error('Failed to load stats:', err);
    // Set defaults on error
    document.getElementById('todayCount').textContent = '0';
    document.getElementById('todayMinutes').textContent = '0m';
    document.getElementById('streakCount').textContent = '0';
  }
}

function toggleHistory() {
  const historyList = document.getElementById('historyList');
  const toggleBtn = document.getElementById('historyToggle');
  
  if (historyList.classList.contains('visible')) {
    historyList.classList.remove('visible');
    toggleBtn.textContent = 'Show ▼';
  } else {
    historyList.classList.add('visible');
    toggleBtn.textContent = 'Hide ▲';
  }
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m ${secs}s`;
}

// Save completed timer to history (called from background.js via message)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate message structure
  if (!message || typeof message !== 'object') return;

  if (message.action === 'timerCompleted' && message.timer) {
    addToHistory(message.timer);
  }
});

async function addToHistory(timer) {
  const result = await chrome.storage.local.get(['history']);
  const history = result.history || [];
  
  history.push({
    name: timer.name,
    duration: timer.totalSeconds,
    completedAt: Date.now()
  });
  
  // Keep only last 100 entries
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }
  
  await chrome.storage.local.set({ history });
  await loadHistory();
  await loadStats();
}

function updateAllTimerDisplays() {
  timers.forEach(timer => {
    if (timer.isRunning) {
      // Calculate remaining based on end time
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((timer.endTime - now) / 1000));
      timer.remainingSeconds = remaining;
      
      // If timer ended, handle it
      if (remaining <= 0) {
        timer.isRunning = false;
        timer.remainingSeconds = 0;
        renderTimers(); // Re-render to show updated state/remove if needed
      }
    }
    
    // Update DOM elements for this timer
    const card = document.querySelector(`.timer-card[data-id="${timer.id}"]`);
    if (card) {
      // Update text
      const timeDisplay = card.querySelector('.timer-display-overlay');
      if (timeDisplay) {
        timeDisplay.textContent = formatTime(timer.remainingSeconds);
      }
      
      // Update progress ring
      const circle = card.querySelector('.progress-ring-fill');
      if (circle) {
        const circumference = parseFloat(circle.dataset.circumference);
        const progress = timer.totalSeconds > 0 ? timer.remainingSeconds / timer.totalSeconds : 0;
        const dashOffset = circumference * (1 - progress);
        circle.style.strokeDashoffset = dashOffset;
      }
    }
  });
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatEndTime(timestamp) {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  return `${hours}:${minutes} ${ampm}`;
}

// ===== SEQUENCES =====

async function loadSequences() {
  try {
    const result = await chrome.storage.local.get(['sequences']);
    const sequences = result.sequences || [];

    const section = document.getElementById('sequencesSection');
    const select = document.getElementById('sequenceSelect');

    if (sequences.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    select.innerHTML = '<option value="">Select a sequence...</option>' +
      sequences.map(seq => {
        const stepCount = seq.steps.length;
        const loopBadge = seq.loop ? ' 🔁' : '';
        return `<option value="${seq.id}">${escapeHtml(seq.name)} (${stepCount} steps)${loopBadge}</option>`;
      }).join('');
  } catch (err) {
    console.error('Failed to load sequences:', err);
  }
}

async function loadActiveSequence() {
  try {
    const result = await chrome.storage.local.get(['activeSequence']);
    const activeSequence = result.activeSequence;

    // Remove existing progress display if any
    const existingProgress = document.querySelector('.sequence-progress');
    if (existingProgress) {
      existingProgress.remove();
    }

    if (!activeSequence) return;

    // Create progress display
    const progressDiv = document.createElement('div');
    progressDiv.className = 'sequence-progress';
    progressDiv.innerHTML = `
      <div class="sequence-progress-header">
        <span class="sequence-progress-name">🔗 ${escapeHtml(activeSequence.name)}</span>
        <button class="sequence-stop-btn" id="stopSequenceBtn">Stop</button>
      </div>
      <div class="sequence-progress-steps">
        ${activeSequence.steps.map((step, i) => {
          let className = 'sequence-step-indicator';
          if (i < activeSequence.currentStep) className += ' completed';
          else if (i === activeSequence.currentStep) className += ' current';
          return `<span class="${className}">${STEP_LABELS[step] || step}</span>`;
        }).join('')}
      </div>
    `;

    // Insert after presets section
    const presetsSection = document.querySelector('.presets-section');
    presetsSection.after(progressDiv);

    // Add stop button listener
    document.getElementById('stopSequenceBtn').addEventListener('click', stopSequence);
  } catch (err) {
    console.error('Failed to load active sequence:', err);
  }
}

async function startSequence() {
  const select = document.getElementById('sequenceSelect');
  const sequenceId = select.value;

  if (!sequenceId) {
    showAlert('Please select a sequence');
    return;
  }

  try {
    const result = await chrome.storage.local.get(['sequences', 'settings']);
    const sequences = result.sequences || [];
    const settings = result.settings || {};
    const sequence = sequences.find(s => s.id === sequenceId);

    if (!sequence) {
      showAlert('Sequence not found');
      return;
    }

    // Store active sequence state
    const activeSequence = {
      id: sequence.id,
      name: sequence.name,
      steps: sequence.steps,
      loop: sequence.loop,
      currentStep: 0
    };

    await chrome.storage.local.set({ activeSequence });

    // Start the first timer in the sequence
    await startSequenceStep(activeSequence, settings);

    // Refresh UI
    await loadActiveSequence();
    select.value = '';

    showAlert(`Started: ${sequence.name}`);
  } catch (err) {
    console.error('Failed to start sequence:', err);
    showAlert('Failed to start sequence');
  }
}

async function startSequenceStep(activeSequence, settings) {
  const stepType = activeSequence.steps[activeSequence.currentStep];
  const presets = settings.presets || {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15,
    deepWork: 52
  };

  const durationMap = {
    pomodoro: presets.pomodoro,
    shortBreak: presets.shortBreak,
    longBreak: presets.longBreak,
    deepWork: presets.deepWork
  };

  const nameMap = {
    pomodoro: 'Pomodoro',
    shortBreak: 'Short Break',
    longBreak: 'Long Break',
    deepWork: 'Deep Work'
  };

  const minutes = durationMap[stepType] || 25;
  const name = nameMap[stepType] || stepType;

  const timer = {
    id: Date.now().toString(),
    name: name,
    totalSeconds: minutes * 60,
    remainingSeconds: minutes * 60,
    endTime: Date.now() + (minutes * 60 * 1000),
    soundType: 'chime',
    notificationMsg: `${name} complete!`,
    isRunning: true,
    sequenceTimer: true // Mark as part of a sequence
  };

  timers.push(timer);
  await saveTimers();

  chrome.runtime.sendMessage({
    action: 'createTimer',
    timer: timer
  });

  renderTimers();
}

async function stopSequence() {
  try {
    await chrome.storage.local.remove('activeSequence');
    await loadActiveSequence();
    showAlert('Sequence stopped');
  } catch (err) {
    console.error('Failed to stop sequence:', err);
  }
}

// ═══════════════════════════════════════════════════
// CIRCADIAN RHYTHM FUNCTIONS
// ═══════════════════════════════════════════════════

async function initCircadian() {
  // Load saved energy preference
  const result = await chrome.storage.local.get(['userEnergy']);
  if (result.userEnergy) {
    userEnergy = result.userEnergy;
  }
  
  // Sync slider and pills with saved state
  const sliderMap = { 'low': 1, 'medium': 2, 'high': 3 };
  const slider = document.getElementById('energySlider');
  if (slider) {
    slider.value = sliderMap[userEnergy] || 2;
  }
  updateEnergyPills(userEnergy);
  
  // Initial update
  updateCircadianRec();
  
  // Update every 30 minutes
  setInterval(updateCircadianRec, 60000 * 30);
  
  // Setup event listeners for energy controls
  setupCircadianListeners();
}

function setupCircadianListeners() {
  // Energy Slider
  const slider = document.getElementById('energySlider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      const map = { 1: 'low', 2: 'medium', 3: 'high' };
      setEnergyLevel(map[val]);
    });
  }
  
  // Preset Pills
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      setEnergyLevel(pill.dataset.energy);
      // Sync slider
      const mapVal = { 'low': 1, 'medium': 2, 'high': 3 };
      const slider = document.getElementById('energySlider');
      if (slider) {
        slider.value = mapVal[pill.dataset.energy];
      }
    });
  });
}

function setEnergyLevel(level) {
  userEnergy = level;
  updateEnergyPills(level);
  updateCircadianRec();
  
  // Save preference
  chrome.storage.local.set({ userEnergy: level });
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

function updateCircadianRec() {
  const hour = new Date().getHours();
  const pattern = CIRCADIAN_PATTERNS[hour];
  
  // Update Header Indicator
  const iconEl = document.getElementById('circadianIcon');
  const labelEl = document.getElementById('circadianLabel');
  if (iconEl) iconEl.textContent = pattern.icon;
  if (labelEl) labelEl.textContent = pattern.msg;
  
  // Apply multiplier based on user energy setting
  const multiplier = ENERGY_MULTIPLIERS[userEnergy];
  const recommendedMinutes = Math.round((pattern.duration / 60) * multiplier);
  
  // Generate detailed productivity tips based on actual time
  let suggestion = '';
  
  if (hour >= 5 && hour <= 7) {
    suggestion = `🌅 Morning routine time. Start with ${recommendedMinutes}min planning or light tasks before peak focus`;
  } else if (hour >= 8 && hour <= 11) {
    suggestion = `🧠 Peak cognitive time! Tackle complex problems, writing, or coding in ${recommendedMinutes}min blocks`;
  } else if (hour === 12) {
    suggestion = `🍽️ Take a proper break. Light ${recommendedMinutes}min tasks only - save deep work for later`;
  } else if (hour >= 13 && hour <= 14) {
    suggestion = `😴 Natural energy dip. Try ${recommendedMinutes}min of admin tasks, emails, or take a power nap`;
  } else if (hour === 15) {
    suggestion = `📈 Energy returning. Good for ${recommendedMinutes}min collaborative work or meetings`;
  } else if (hour >= 16 && hour <= 17) {
    suggestion = `⚡ Second wind! Great for ${recommendedMinutes}min creative tasks, brainstorming, or finishing projects`;
  } else if (hour >= 18 && hour <= 19) {
    suggestion = `🌆 Evening focus. ${recommendedMinutes}min sessions for wrapping up or personal projects`;
  } else if (hour >= 20 && hour <= 21) {
    suggestion = `🌙 Winding down. Light ${recommendedMinutes}min tasks - avoid screens if possible`;
  } else if (hour >= 22 && hour <= 23) {
    suggestion = `✨ Rest time approaching. Only essential ${recommendedMinutes}min tasks - protect your sleep`;
  } else if (hour >= 0 && hour <= 4) {
    suggestion = `🦉 Late night. If you must work, keep to quick ${recommendedMinutes}min sprints with breaks`;
  } else {
    suggestion = `💡 Try ${recommendedMinutes}min focused sessions based on your current energy`;
  }
  
  const recEl = document.getElementById('circadianRec');
  if (recEl) recEl.textContent = suggestion;
  
  // Generate suggested task cards
  renderSuggestedTasks(hour, recommendedMinutes);
}

function renderSuggestedTasks(hour, baseMinutes) {
  const container = document.getElementById('suggestedTasks');
  if (!container) return;
  
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
      createPresetTimer(task.minutes, task.name);
    });
    container.appendChild(card);
  });
}
