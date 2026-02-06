// Badge update interval
let badgeInterval = null;

// Timer type constants
const WORK_TIMERS = ['Pomodoro', 'Deep Work'];
const BREAK_TIMERS = ['Short Break', 'Long Break'];

// Check if a timer is a work session
function isWorkTimer(timerName) {
  return WORK_TIMERS.some(name => timerName.includes(name));
}

// Check if a timer is a break
function isBreakTimer(timerName) {
  return BREAK_TIMERS.some(name => timerName.includes(name));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.action, message);
  if (message.action === 'createTimer') {
    createAlarm(message.timer);
    startBadgeUpdates();
  } else if (message.action === 'cancelTimer') {
    chrome.alarms.clear(message.timerId);
    updateBadge();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm fired:', alarm.name, alarm);
  
  // Get timer data to find the sound type and notification message
  const result = await chrome.storage.local.get(['timers', 'settings', 'activeSequence', 'customSounds', 'customAudio']);
  let timers = result.timers || [];
  const settings = result.settings || {};
  const activeSequence = result.activeSequence;
  
  console.log('Current timers in storage:', timers);
  const timer = timers.find(t => t.id === alarm.name);

  if (!timer) {
    console.warn('Timer not found for alarm:', alarm.name);
    return;
  }
  
  console.log('Timer found:', timer);

  // Check if sound is enabled in settings
  const soundEnabled = settings.soundEnabled !== false;

  if (soundEnabled) {
    // Play sound via offscreen document
    try {
      const docReady = await ensureOffscreenDocument();
      if (!docReady) {
        console.error('Could not create offscreen document for audio');
      } else {
        // Small delay to ensure offscreen document scripts are loaded
        await new Promise(resolve => setTimeout(resolve, 150));

        // Resolve sound URL here to avoid storage access issues in offscreen document
        let soundUrl = null;
        const soundType = timer.soundType || 'chime';
        const customSounds = result.customSounds || [];
        const customAudio = result.customAudio;

        // Built-in sounds map
        const soundMap = {
          'chime': 'sounds/chime.wav',
          'water': 'sounds/water.wav',
          'alarm': 'sounds/alarm.wav',
          'bell': 'sounds/bell.wav',
          'birds': 'sounds/birds.wav',
          'gong': 'sounds/gong.wav',
          'piano': 'sounds/piano.wav'
        };

        if (soundType.startsWith('custom_')) {
          const soundId = soundType.replace('custom_', '');
          const customSound = customSounds.find(s => s.id === soundId);
          if (customSound && customSound.data) {
            soundUrl = customSound.data;
          }
        } else if (soundType === 'custom') {
            if (customAudio) {
                soundUrl = customAudio;
            }
        } else {
            if (soundMap[soundType]) {
                soundUrl = chrome.runtime.getURL(soundMap[soundType]);
            }
        }

        // Fallback to chime if no URL resolved
        if (!soundUrl) {
            console.warn('Sound not found, using default chime');
            soundUrl = chrome.runtime.getURL(soundMap['chime']);
        }

        const response = await chrome.runtime.sendMessage({
          action: 'playSound',
          soundUrl: soundUrl,
          volume: settings.volume !== undefined ? settings.volume : 70
        });

        if (response && !response.success) {
          console.error('Sound playback failed:', response.error);
        }
      }
    } catch (err) {
      console.error('Failed to play sound:', err);
    }
  }

  // Save to history
  await saveToHistory(timer).catch(err => console.error('Failed to save history:', err));

  // Save as last completed timer for restart functionality
  await chrome.storage.local.set({ lastCompletedTimer: timer });

  const notificationId = `timer-${timer.id}`;

  const notificationsEnabled = settings.notificationsEnabled !== false;
  console.log('Notifications enabled:', notificationsEnabled, 'Settings:', settings);

  if (notificationsEnabled) {
    // Show notification with custom message and buttons
    console.log('Creating notification with buttons for:', timer.name);
    
    // Clear any existing notification with this ID first just in case
    await new Promise(resolve => chrome.notifications.clear(notificationId, resolve));

    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '✨ Timer Complete!',
      message: timer.notificationMsg || `Your timer "${timer.name}" has finished`,
      priority: 2,
      requireInteraction: true,
      buttons: [
        { title: '🔄 Snooze 5min' },
        { title: '🛑 Stop Sound' }
      ]
    }, (id) => {
      if (chrome.runtime.lastError) {
        console.error('Notification creation failed:', chrome.runtime.lastError);
      } else {
        console.log('Notification created successfully with ID:', id);
      }
    });
  }

  // Clean up finished timer
  timers = timers.filter(t => t.id !== alarm.name);
  await chrome.storage.local.set({ timers }).catch(err => console.error('Failed to update timers:', err));

  // Check if this was part of an active sequence
  if (timer.sequenceTimer && activeSequence) {
    await handleSequenceProgression(activeSequence, settings, timers);
  } else if (settings.autoStartBreaks && !timer.sequenceTimer) {
    // Only auto-start breaks for non-sequence timers
    await handleAutoStart(timer, settings, timers);
  }

  // Update badge
  updateBadge();
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  // Check if it's a timer notification
  if (notificationId.startsWith('timer-')) {
    if (buttonIndex === 0) {
      // Snooze 5min button clicked
      await snoozeTimer(5);
      chrome.notifications.clear(notificationId);
      chrome.runtime.sendMessage({ action: 'stopSound' }).catch(() => {});
    } else if (buttonIndex === 1) {
      // Stop Sound button clicked
      chrome.notifications.clear(notificationId);
      chrome.runtime.sendMessage({ action: 'stopSound' }).catch(() => {});
    }
  }
});

// Snooze function - creates a new timer with specified minutes
async function snoozeTimer(minutes) {
  const result = await chrome.storage.local.get(['lastCompletedTimer', 'timers']);
  const lastTimer = result.lastCompletedTimer;
  let appTimers = result.timers || [];

  if (lastTimer) {
    const snoozeSeconds = minutes * 60;
    const newTimer = {
      id: Date.now().toString(),
      name: `${lastTimer.name} (Snooze)`,
      totalSeconds: snoozeSeconds,
      remainingSeconds: snoozeSeconds,
      endTime: Date.now() + (snoozeSeconds * 1000),
      soundType: lastTimer.soundType || 'chime',
      notificationMsg: lastTimer.notificationMsg || `Snooze complete! ⏰`,
      isRunning: true,
      autoStarted: false,
      sequenceTimer: false
    };

    appTimers.push(newTimer);
    await chrome.storage.local.set({ timers: appTimers });
    
    createAlarm(newTimer);
    startBadgeUpdates();
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🔔 Snoozed',
      message: `${lastTimer.name} snoozed for ${minutes} min`,
      priority: 1
    });
  }
}

// Handle snooze message from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'snoozeTimer' && message.minutes) {
    snoozeTimerById(message.timerId, message.minutes).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error('Snooze failed:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
  }
});

// Snooze a specific timer by ID
async function snoozeTimerById(timerId, minutes) {
  const result = await chrome.storage.local.get(['timers']);
  let appTimers = result.timers || [];
  const timer = appTimers.find(t => t.id === timerId);

  if (timer) {
    // Cancel the current timer alarm
    await chrome.alarms.clear(timerId);
    
    // Update the timer with snooze time
    const snoozeSeconds = minutes * 60;
    timer.remainingSeconds = snoozeSeconds;
    timer.totalSeconds = snoozeSeconds;
    timer.endTime = Date.now() + (snoozeSeconds * 1000);
    timer.isRunning = true;
    timer.name = timer.name.includes('(Snooze)') ? timer.name : `${timer.name} (Snooze)`;

    await chrome.storage.local.set({ timers: appTimers });
    
    createAlarm(timer);
    startBadgeUpdates();
  }
}

// Handle notification close (stop sound if user dismisses)
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  if (byUser && notificationId.startsWith('timer-')) {
    chrome.runtime.sendMessage({ action: 'stopSound' }).catch(() => {});
  }
});

// Handle sequence progression
async function handleSequenceProgression(activeSequence, settings, currentTimers) {
  const nextStep = activeSequence.currentStep + 1;

  if (nextStep >= activeSequence.steps.length) {
    // Sequence complete
    if (activeSequence.loop) {
      // Restart sequence
      activeSequence.currentStep = 0;
      await chrome.storage.local.set({ activeSequence });
      await startNextSequenceTimer(activeSequence, settings, currentTimers);

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🔁 Sequence Restarting',
        message: `${activeSequence.name} is starting again`,
        priority: 1
      }).catch(() => {});
    } else {
      // Sequence finished - clear it
      await chrome.storage.local.remove('activeSequence');

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🎉 Sequence Complete!',
        message: `${activeSequence.name} has finished`,
        priority: 2
      }).catch(() => {});
    }
  } else {
    // Move to next step
    activeSequence.currentStep = nextStep;
    await chrome.storage.local.set({ activeSequence });
    await startNextSequenceTimer(activeSequence, settings, currentTimers);
  }
}

// Start the next timer in a sequence
async function startNextSequenceTimer(activeSequence, settings, currentTimers) {
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
    sequenceTimer: true
  };

  currentTimers.push(timer);
  await chrome.storage.local.set({ timers: currentTimers });

  createAlarm(timer);
  startBadgeUpdates();

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '⏱️ Next in Sequence',
    message: `${name} (${minutes} min) started`,
    priority: 1
  }).catch(() => {});
}

// Handle auto-starting the next timer in sequence
async function handleAutoStart(completedTimer, settings, currentTimers) {
  const presets = settings.presets || {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15,
    deepWork: 52
  };

  let nextTimer = null;

  if (isWorkTimer(completedTimer.name)) {
    // Work session completed - start a break
    // Get pomodoro count to determine short vs long break
    const statsResult = await chrome.storage.local.get(['pomodoroCount']);
    let pomodoroCount = (statsResult.pomodoroCount || 0) + 1;

    // Long break after every 4 pomodoros
    const isLongBreak = pomodoroCount % 4 === 0;
    const breakMinutes = isLongBreak ? presets.longBreak : presets.shortBreak;
    const breakName = isLongBreak ? 'Long Break' : 'Short Break';

    // Save updated pomodoro count
    await chrome.storage.local.set({ pomodoroCount });

    nextTimer = {
      id: Date.now().toString(),
      name: breakName,
      totalSeconds: breakMinutes * 60,
      remainingSeconds: breakMinutes * 60,
      endTime: Date.now() + (breakMinutes * 60 * 1000),
      soundType: completedTimer.soundType || 'chime',
      notificationMsg: `${breakName} complete! Back to work! 💪`,
      isRunning: true,
      autoStarted: true
    };
  } else if (isBreakTimer(completedTimer.name)) {
    // Break completed - start a new pomodoro
    const workMinutes = presets.pomodoro;

    nextTimer = {
      id: Date.now().toString(),
      name: 'Pomodoro',
      totalSeconds: workMinutes * 60,
      remainingSeconds: workMinutes * 60,
      endTime: Date.now() + (workMinutes * 60 * 1000),
      soundType: completedTimer.soundType || 'chime',
      notificationMsg: 'Pomodoro complete! Time for a break! 🎉',
      isRunning: true,
      autoStarted: true
    };
  }

  if (nextTimer) {
    // Add to timers list
    currentTimers.push(nextTimer);
    await chrome.storage.local.set({ timers: currentTimers });

    // Create alarm for the new timer
    createAlarm(nextTimer);
    startBadgeUpdates();

    // Show notification about auto-started timer
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⏱️ Next Timer Started',
      message: `${nextTimer.name} (${Math.round(nextTimer.totalSeconds / 60)} min) started automatically`,
      priority: 1
    }).catch(err => console.warn('Auto-start notification failed:', err));
  }
}

async function saveToHistory(timer) {
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
}

function createAlarm(timer) {
  const delayInMinutes = timer.remainingSeconds / 60;
  console.log('Creating alarm for timer:', timer.id, 'Delay (min):', delayInMinutes);
  chrome.alarms.create(timer.id, {
    delayInMinutes: delayInMinutes
  });
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
      justification: 'Playing timer completion sound'
    });

    // Verify it was created
    const newContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    return newContexts.length > 0;
  } catch (err) {
    console.error('Failed to create offscreen document:', err);
    return false;
  }
}

// Badge functions
function startBadgeUpdates() {
  // Clear any existing interval to prevent race conditions/duplicates
  if (badgeInterval) {
    clearInterval(badgeInterval);
  }

  updateBadge();
  badgeInterval = setInterval(updateBadge, 1000);
}

async function updateBadge() {
  const result = await chrome.storage.local.get(['timers']);
  const timers = result.timers || [];
  
  // Find the timer with the shortest remaining time
  const runningTimers = timers.filter(t => t.isRunning);
  
  if (runningTimers.length === 0) {
    // No running timers - clear badge
    chrome.action.setBadgeText({ text: '' });
    if (badgeInterval) {
      clearInterval(badgeInterval);
      badgeInterval = null;
    }
    return;
  }
  
  // Find the timer ending soonest
  let soonestTimer = null;
  let shortestTime = Infinity;
  
  for (const timer of runningTimers) {
    const remaining = Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000));
    if (remaining < shortestTime) {
      shortestTime = remaining;
      soonestTimer = timer;
    }
  }
  
  if (shortestTime <= 0) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  
  // Format badge text
  const badgeText = formatBadgeTime(shortestTime);
  
  // Set badge with gradient-like colors
  chrome.action.setBadgeBackgroundColor({ color: '#9b87f5' });
  chrome.action.setBadgeTextColor({ color: '#ffffff' });
  chrome.action.setBadgeText({ text: badgeText });
}

function formatBadgeTime(seconds) {
  if (seconds >= 3600) {
    // Hours: show as "1h" or "2h"
    return Math.floor(seconds / 3600) + 'h';
  } else if (seconds >= 60) {
    // Minutes: show as "5m" or "25m"
    return Math.floor(seconds / 60) + 'm';
  } else {
    // Seconds: show as "30s" or "5s"
    return seconds + 's';
  }
}

// Initialize badge on startup
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

// Also check on install
chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
});

// Keyboard shortcut handlers
chrome.commands.onCommand.addListener(async (command) => {
  const result = await chrome.storage.local.get(['settings', 'timers']);
  const settings = result.settings || {};
  let timers = result.timers || [];
  const presets = settings.presets || {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15,
    deepWork: 52
  };

  if (command === 'start-pomodoro') {
    const minutes = presets.pomodoro;
    const timer = {
      id: Date.now().toString(),
      name: 'Pomodoro',
      totalSeconds: minutes * 60,
      remainingSeconds: minutes * 60,
      endTime: Date.now() + (minutes * 60 * 1000),
      soundType: 'chime',
      notificationMsg: 'Pomodoro complete! Time for a break! 🎉',
      isRunning: true
    };

    timers.push(timer);
    await chrome.storage.local.set({ timers });
    createAlarm(timer);
    startBadgeUpdates();

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🍅 Pomodoro Started',
      message: `${minutes} minute focus session started via shortcut`,
      priority: 1
    }).catch(() => {});

  } else if (command === 'start-break') {
    const minutes = presets.shortBreak;
    const timer = {
      id: Date.now().toString(),
      name: 'Short Break',
      totalSeconds: minutes * 60,
      remainingSeconds: minutes * 60,
      endTime: Date.now() + (minutes * 60 * 1000),
      soundType: 'chime',
      notificationMsg: 'Break complete! Back to work! 💪',
      isRunning: true
    };

    timers.push(timer);
    await chrome.storage.local.set({ timers });
    createAlarm(timer);
    startBadgeUpdates();

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '☕ Break Started',
      message: `${minutes} minute break started via shortcut`,
      priority: 1
    }).catch(() => {});

  } else if (command === 'pause-resume') {
    // Find the most recent running timer or paused timer
    const runningTimer = timers.find(t => t.isRunning);
    const pausedTimer = timers.find(t => !t.isRunning);
    const targetTimer = runningTimer || pausedTimer;

    if (!targetTimer) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⏱️ No Timer',
        message: 'No active timer to pause/resume',
        priority: 1
      }).catch(() => {});
      return;
    }

    if (targetTimer.isRunning) {
      // Pause the timer
      targetTimer.isRunning = false;
      targetTimer.remainingSeconds = Math.max(0, Math.ceil((targetTimer.endTime - Date.now()) / 1000));
      await chrome.alarms.clear(targetTimer.id);

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⏸️ Timer Paused',
        message: `${targetTimer.name} paused`,
        priority: 1
      }).catch(() => {});
    } else {
      // Resume the timer
      targetTimer.isRunning = true;
      targetTimer.endTime = Date.now() + (targetTimer.remainingSeconds * 1000);
      createAlarm(targetTimer);
      startBadgeUpdates();

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '▶️ Timer Resumed',
        message: `${targetTimer.name} resumed`,
        priority: 1
      }).catch(() => {});
    }

    await chrome.storage.local.set({ timers });
    updateBadge();
  }
});
