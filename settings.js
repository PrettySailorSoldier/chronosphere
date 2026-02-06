// Default settings
const defaultSettings = {
  soundEnabled: true,
  volume: 70,
  notificationsEnabled: true,
  autoStartBreaks: false,
  presets: {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15,
    deepWork: 52
  }
};

// Step type display names
const STEP_LABELS = {
  pomodoro: '🍅 Pomodoro',
  shortBreak: '☕ Short Break',
  longBreak: '🌙 Long Break',
  deepWork: '🎯 Deep Work'
};

// Current sequence being built
let currentSequenceSteps = [];

// Load settings on page open
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadSequences();
  await loadCustomSounds();
  loadTheme();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'popup.html';
  });

  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);

  // Theme selector - instant apply
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    window.ChronoTheme.save(e.target.value);
  });

  // Sequence builder events
  document.getElementById('addStepBtn').addEventListener('click', addSequenceStep);
  document.getElementById('saveSequenceBtn').addEventListener('click', saveSequence);
}

function loadTheme() {
  const theme = window.ChronoTheme.get();
  document.getElementById('themeSelect').value = theme;
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || defaultSettings;

    // Apply settings to UI
    document.getElementById('soundEnabled').checked = settings.soundEnabled;
    document.getElementById('volume').value = settings.volume;
    updateVolumeDisplay();
    document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled;
    document.getElementById('autoStartBreaks').checked = settings.autoStartBreaks;

    // Preset times
    document.getElementById('pomodoroTime').value = settings.presets?.pomodoro || 25;
    document.getElementById('shortBreakTime').value = settings.presets?.shortBreak || 5;
    document.getElementById('longBreakTime').value = settings.presets?.longBreak || 15;
    document.getElementById('deepWorkTime').value = settings.presets?.deepWork || 52;
  } catch (err) {
    console.error('Failed to load settings:', err);
    showToast('Failed to load settings');
  }
}

async function saveSettings() {
  // Parse and validate preset values
  const pomodoro = parseInt(document.getElementById('pomodoroTime').value);
  const shortBreak = parseInt(document.getElementById('shortBreakTime').value);
  const longBreak = parseInt(document.getElementById('longBreakTime').value);
  const deepWork = parseInt(document.getElementById('deepWorkTime').value);
  const volume = parseInt(document.getElementById('volume').value);

  // Validate preset times (1-1440 minutes = 1 min to 24 hours)
  const validateTime = (val, name) => {
    if (isNaN(val) || val < 1 || val > 1440) {
      showToast(`${name} must be 1-1440 minutes`);
      return false;
    }
    return true;
  };

  if (!validateTime(pomodoro, 'Pomodoro')) return;
  if (!validateTime(shortBreak, 'Short Break')) return;
  if (!validateTime(longBreak, 'Long Break')) return;
  if (!validateTime(deepWork, 'Deep Work')) return;

  // Validate volume (0-100)
  if (isNaN(volume) || volume < 0 || volume > 100) {
    showToast('Volume must be 0-100');
    return;
  }

  const settings = {
    soundEnabled: document.getElementById('soundEnabled').checked,
    volume: volume,
    notificationsEnabled: document.getElementById('notificationsEnabled').checked,
    autoStartBreaks: document.getElementById('autoStartBreaks').checked,
    presets: {
      pomodoro,
      shortBreak,
      longBreak,
      deepWork
    }
  };

  try {
    await chrome.storage.local.set({ settings });
    showToast('Settings saved! ✨');
  } catch (err) {
    console.error('Failed to save settings:', err);
    showToast('Failed to save settings');
  }
}

async function resetSettings() {
  try {
    await chrome.storage.local.set({ settings: defaultSettings });
    await loadSettings();
    showToast('Settings reset to defaults');
  } catch (err) {
    console.error('Failed to reset settings:', err);
    showToast('Failed to reset settings');
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #9b87f5, #ff69b4);
    color: white;
    padding: 12px 24px;
    border-radius: 10px;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ===== SEQUENCES =====

async function loadSequences() {
  try {
    const result = await chrome.storage.local.get(['sequences']);
    const sequences = result.sequences || [];
    renderSequencesList(sequences);
  } catch (err) {
    console.error('Failed to load sequences:', err);
  }
}

function renderSequencesList(sequences) {
  const container = document.getElementById('sequencesList');

  if (sequences.length === 0) {
    container.innerHTML = '<div class="empty-sequences">No sequences yet. Create one below!</div>';
    return;
  }

  container.innerHTML = sequences.map(seq => {
    const preview = seq.steps.map(s => STEP_LABELS[s] || s).join(' → ');
    const loopBadge = seq.loop ? ' 🔁' : '';
    return `
      <div class="sequence-item" data-id="${seq.id}">
        <div class="sequence-info">
          <div class="sequence-name">${escapeHtml(seq.name)}${loopBadge}</div>
          <div class="sequence-preview">${preview}</div>
        </div>
        <button class="sequence-delete-btn" data-id="${seq.id}">🗑️ Delete</button>
      </div>
    `;
  }).join('');

  // Add delete event listeners
  container.querySelectorAll('.sequence-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteSequence(btn.dataset.id));
  });
}

function addSequenceStep() {
  const stepType = document.getElementById('stepTypeSelect').value;
  currentSequenceSteps.push(stepType);
  renderSequenceSteps();
}

function renderSequenceSteps() {
  const container = document.getElementById('sequenceSteps');

  if (currentSequenceSteps.length === 0) {
    container.innerHTML = '<span style="color: rgba(255,255,255,0.3); font-size: 12px;">Add steps to build your sequence...</span>';
    return;
  }

  container.innerHTML = currentSequenceSteps.map((step, index) => `
    <span class="step-tag">
      ${STEP_LABELS[step] || step}
      <span class="step-remove" data-index="${index}">✕</span>
    </span>
  `).join('');

  // Add remove listeners
  container.querySelectorAll('.step-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSequenceSteps.splice(parseInt(btn.dataset.index), 1);
      renderSequenceSteps();
    });
  });
}

async function saveSequence() {
  const name = document.getElementById('newSequenceName').value.trim();
  const loop = document.getElementById('sequenceLoop').checked;

  if (!name) {
    showToast('Please enter a sequence name');
    return;
  }

  if (currentSequenceSteps.length < 2) {
    showToast('Add at least 2 steps');
    return;
  }

  const newSequence = {
    id: Date.now().toString(),
    name,
    steps: [...currentSequenceSteps],
    loop
  };

  try {
    const result = await chrome.storage.local.get(['sequences']);
    const sequences = result.sequences || [];
    sequences.push(newSequence);
    await chrome.storage.local.set({ sequences });

    // Clear builder
    currentSequenceSteps = [];
    document.getElementById('newSequenceName').value = '';
    document.getElementById('sequenceLoop').checked = false;
    renderSequenceSteps();
    renderSequencesList(sequences);

    showToast('Sequence saved! 🎉');
  } catch (err) {
    console.error('Failed to save sequence:', err);
    showToast('Failed to save sequence');
  }
}

async function deleteSequence(id) {
  try {
    const result = await chrome.storage.local.get(['sequences']);
    let sequences = result.sequences || [];
    sequences = sequences.filter(s => s.id !== id);
    await chrome.storage.local.set({ sequences });
    renderSequencesList(sequences);
    showToast('Sequence deleted');
  } catch (err) {
    console.error('Failed to delete sequence:', err);
    showToast('Failed to delete sequence');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== CUSTOM SOUNDS =====

async function loadCustomSounds() {
  try {
    const result = await chrome.storage.local.get(['customSounds']);
    const customSounds = result.customSounds || [];
    renderCustomSoundsList(customSounds);
  } catch (err) {
    console.error('Failed to load custom sounds:', err);
  }
}

// Initialize steps display
renderSequenceSteps();

// ===== AUDIO PREVIEW =====

let audioDebounceTimer = null;

async function updateVolumeDisplay() {
  const volumeSlider = document.getElementById('volume');
  const volumeValue = document.getElementById('volumeValue');
  if (volumeSlider && volumeValue) {
    volumeValue.textContent = `${volumeSlider.value}%`;
  }
}

async function playSound(url) {
  try {
    const hasOffscreen = await ensureOffscreenDocument();
    if (!hasOffscreen) {
      console.error('Could not create offscreen document');
      return;
    }

    const volume = parseInt(document.getElementById('volume').value) || 70;
    
    // Tiny delay to ensure offscreen is ready if just created
    await new Promise(resolve => setTimeout(resolve, 100));

    await chrome.runtime.sendMessage({
      action: 'playSound',
      soundUrl: url,
      volume: volume
    });
  } catch (err) {
    console.error('Failed to play sound:', err);
  }
}

async function stopSound() {
  try {
    await chrome.runtime.sendMessage({ action: 'stopSound' });
  } catch (err) {
    console.error('Failed to stop sound:', err);
  }
}

async function ensureOffscreenDocument() {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      return true;
    }

    // Create new offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Playing sound preview'
    });

    return true;
  } catch (err) {
    // Ignore error if document was created while we were checking
    if (!err.message.includes('Only one offscreen')) {
      console.error('Failed to create offscreen document:', err);
      return false;
    }
    return true;
  }
}

// Initial volume update and listeners
document.addEventListener('DOMContentLoaded', () => {
    // updateVolumeDisplay is called in loadSettings too, but we attach listeners here
    const volumeSlider = document.getElementById('volume');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', () => {
            updateVolumeDisplay();
            
            // Debounce sound preview
            if (audioDebounceTimer) clearTimeout(audioDebounceTimer);
            audioDebounceTimer = setTimeout(() => {
                const chimeUrl = chrome.runtime.getURL('sounds/chime.wav');
                playSound(chimeUrl);
            }, 300); // 300ms debounce
        });
    }

    const previewBtn = document.getElementById('previewSoundBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            const chimeUrl = chrome.runtime.getURL('sounds/chime.wav');
            playSound(chimeUrl);
        });
    }

    const stopBtn = document.getElementById('stopSoundBtn');
    if (stopBtn) {
        stopBtn.addEventListener('click', stopSound);
    }
});

// Update render function to include play button
function renderCustomSoundsList(sounds) {
  const container = document.getElementById('customSoundsList');
  if (!container) return;

  if (sounds.length === 0) {
    container.innerHTML = '<div class="empty-sounds">No custom sounds. Upload from the main timer page.</div>';
    return;
  }

  container.innerHTML = sounds.map(sound => {
    const date = new Date(sound.createdAt);
    const dateStr = date.toLocaleDateString();
    return `
      <div class="custom-sound-item" data-id="${sound.id}">
        <div class="sound-info">
          <div class="sound-name">🎵 ${escapeHtml(sound.name)}</div>
          <div class="sound-date">Added ${dateStr}</div>
        </div>
        <div style="display: flex; gap: 6px;">
            <button class="sound-control-btn play-custom-btn" data-id="${sound.id}" aria-label="Play ${escapeHtml(sound.name)}">▶️</button>
            <button class="sound-delete-btn" data-id="${sound.id}" aria-label="Delete ${escapeHtml(sound.name)}">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  container.querySelectorAll('.sound-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCustomSound(btn.dataset.id));
  });

  container.querySelectorAll('.play-custom-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const result = await chrome.storage.local.get(['customSounds']);
        const customSounds = result.customSounds || [];
        const sound = customSounds.find(s => s.id === id);
        if (sound && sound.data) {
            playSound(sound.data);
        }
    });
  });
}

async function deleteCustomSound(id) {
  try {
    const result = await chrome.storage.local.get(['customSounds']);
    let customSounds = result.customSounds || [];
    customSounds = customSounds.filter(s => s.id !== id);
    await chrome.storage.local.set({ customSounds });
    renderCustomSoundsList(customSounds);
    showToast('Sound deleted');
  } catch (err) {
    console.error('Failed to delete custom sound:', err);
    showToast('Failed to delete sound');
  }
}

// Initialize steps display
renderSequenceSteps();
