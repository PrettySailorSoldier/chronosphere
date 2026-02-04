importScripts('tab-freeze.js');

const freezeManager = new TabFreezeManager();

// ═══════════════════════════════════════════════════
// MIGRATION & INSTALL
// ═══════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update' || details.reason === 'install') {
    await migrateTimerHistory();
    // Create offscreen document for audio
    createOffscreen();
  }
});

chrome.runtime.onStartup.addListener(() => {
    createOffscreen();
});

async function createOffscreen() {
    // Check if exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: ['offscreen.html']
    });

    if (existingContexts.length > 0) return;

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play timer completion sounds'
    });
}

async function migrateTimerHistory() {
  const result = await chrome.storage.local.get(['history']);
  let history = result.history || [];
  
  // Transform old entries to new schema
  history = history.map(entry => {
    // If missing new fields, add defaults
    if (entry.completedFully === undefined) entry.completedFully = true;
    if (!entry.type) entry.type = (entry.minutes > 20) ? 'focus' : 'break';
    
    // Add time metadata if timestamp exists
    if (entry.timestamp && !entry.dayOfWeek) {
        const date = new Date(entry.timestamp);
        entry.hourOfDay = date.getHours();
        entry.dayOfWeek = date.getDay();
    }
    
    return entry;
  });
  
  // Limit to 500
  if (history.length > 500) {
      history = history.slice(0, 500);
  }
  
  await chrome.storage.local.set({ history });
}

// ═══════════════════════════════════════════════════
// ALARMS & MESSAGING
// ═══════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'createAlarm') {
    handleCreateAlarm(msg.timer);
  } else if (msg.type === 'startPomodoro') {
    handleStartPomodoro();
  } else if (msg.type === 'stopTimer') {
    handleStopTimer(msg.id);
  } else if (msg.type === 'pauseTimer') {
    handlePauseTimer(msg.id);
  } else if (msg.type === 'resumeTimer') {
    handleResumeTimer(msg.id);
  } else if (msg.type === 'playSound') {
      // Forward to offscreen
      chrome.runtime.sendMessage(msg);
  }
});

async function handleCreateAlarm(timer) {
  // Create alarm
  // Alarm name = timer.id
  // when = Date.now() + duration (ms)
  await chrome.alarms.create(timer.id, { when: timer.endTime });
  
  // Tab Freeze Trigger (Safe Mode)
  try {
      if (timer.name.toLowerCase().includes('break')) {
          // Unfreeze logic would go here
      } else {
          // Focus timer
          if (freezeManager) {
             const res = await freezeManager.freezeTabs();
             if(res && res.count > 0) {
                 showNotification('Tab Freeze Active', `Frozen ${res.count} tabs to save ~${res.savedMB}MB RAM.`);
             }
          }
      }
  } catch (err) {
      console.error("Tab Freeze Error:", err);
      // Continue creating timer even if freeze fails
  }
  
  await updateBadge();
}

// ═══════════════════════════════════════════════════
// POMODORO SEQUENCE LOGIC
// ═══════════════════════════════════════════════════

async function handleStartPomodoro() {
    // Initialize new sequence
    const sequence = {
        active: true,
        cycle: 1, // 1-4
        phase: 'focus', // focus | shortBreak | longBreak
        totalCycles: 4
    };
    
    await chrome.storage.local.set({ pomodoroSequence: sequence });
    
    // Start first timer
    const id = Date.now().toString();
    const durationMin = 25;
    const endTime = Date.now() + (durationMin * 60 * 1000);
    
    const timers = [{
        id,
        name: "Pomodoro Focus (Cycle 1/4)",
        endTime,
        originalMinutes: durationMin,
        duration: durationMin, // For reference
        type: 'pomodoro',
        status: 'running'
    }];
    
    await chrome.storage.local.set({ timers });
    await handleCreateAlarm(timers[0]);
}

async function advancePomodoroSequence(finishedTimerId) {
    const data = await chrome.storage.local.get(['pomodoroSequence']);
    let seq = data.pomodoroSequence;
    
    if (!seq || !seq.active) return;
    
    // Logic: Focus -> Short Break -> Focus... -> Focus (4) -> Long Break
    
    let nextPhase = '';
    let nextDuration = 0;
    let nextName = '';
    
    if (seq.phase === 'focus') {
        if (seq.cycle < seq.totalCycles) {
            // Next: Short Break
            nextPhase = 'shortBreak';
            nextDuration = 5;
            nextName = `Short Break (Cycle ${seq.cycle})`;
        } else {
            // Next: Long Break
            nextPhase = 'longBreak';
            nextDuration = 15;
            nextName = "Long Break 🌴";
        }
    } else if (seq.phase === 'shortBreak') {
        // Next: Focus (Next Cycle)
        seq.cycle++;
        nextPhase = 'focus';
        nextDuration = 25;
        nextName = `Pomodoro Focus (Cycle ${seq.cycle}/${seq.totalCycles})`;
    } else if (seq.phase === 'longBreak') {
        // Sequence Complete
        seq.active = false;
        await chrome.storage.local.set({ pomodoroSequence: seq });
        showNotification('Sequence Complete', 'Great job! You finished a full Pomodoro cycle.');
        return;
    }
    
    // Update sequence
    seq.phase = nextPhase;
    await chrome.storage.local.set({ pomodoroSequence: seq });
    
    // Start Next Timer
    const id = Date.now().toString();
    const endTime = Date.now() + (nextDuration * 60 * 1000);
    
    const newTimer = {
        id,
        name: nextName,
        endTime,
        originalMinutes: nextDuration,
        duration: nextDuration,
        type: 'pomodoro',
        status: 'running'
    };
    
    // Add to timers list
    const tData = await chrome.storage.local.get(['timers']);
    const timers = tData.timers || [];
    timers.push(newTimer);
    await chrome.storage.local.set({ timers });
    
    await handleCreateAlarm(newTimer);
    
    showNotification('Next Phase Starting', `Starting: ${nextName}`);
}


// ═══════════════════════════════════════════════════
// TIMER CONTROLS
// ═══════════════════════════════════════════════════

async function handlePauseTimer(id) {
    const data = await chrome.storage.local.get(['timers']);
    let timers = data.timers || [];
    const timerIndex = timers.findIndex(t => t.id === id);
    
    if (timerIndex > -1) {
        const timer = timers[timerIndex];
        const now = Date.now();
        const remainingMs = timer.endTime - now;
        
        timer.status = 'paused';
        timer.remainingMs = remainingMs;
        timers[timerIndex] = timer;
        
        await chrome.alarms.clear(id); // Stop alarm
        await chrome.storage.local.set({ timers });
    }
}

async function handleResumeTimer(id) {
    const data = await chrome.storage.local.get(['timers']);
    let timers = data.timers || [];
    const timerIndex = timers.findIndex(t => t.id === id);
    
    if (timerIndex > -1) {
        const timer = timers[timerIndex];
        const now = Date.now();
        
        timer.status = 'running';
        timer.endTime = now + timer.remainingMs; // New end time
        delete timer.remainingMs;
        timers[timerIndex] = timer;
        
        await chrome.storage.local.set({ timers });
        await handleCreateAlarm(timer); // Re-create alarm
    }
}

async function handleStopTimer(id) {
    await chrome.alarms.clear(id);
    
    // If part of sequence, kill sequence
    const data = await chrome.storage.local.get(['pomodoroSequence', 'timers']);
    if (data.pomodoroSequence && data.pomodoroSequence.active) {
        // Check if this timer was the active one?
        // Simpler: Just kill sequence if user manually stops a timer
        await chrome.storage.local.set({ pomodoroSequence: { active: false } });
    }

    let timers = data.timers || [];
    timers = timers.filter(t => t.id !== id);
    await chrome.storage.local.set({ timers });
    
    updateBadge();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Alarm fired = Timer Done
  const id = alarm.name;
  
  const data = await chrome.storage.local.get(['timers', 'history', 'stats', 'sound', 'volume', 'pomodoroSequence']);
  let timers = data.timers || [];
  const timer = timers.find(t => t.id === id);
  
  if (timer) {
    // 1. Play Sound
    const soundName = data.sound || 'chime';
    const volume = data.volume || 0.8;
    chrome.runtime.sendMessage({
        type: 'playSound',
        source: `sounds/${soundName}.mp3`,
        volume: volume
    });
    
    // 2. Notification
    showNotification('Timer Complete', `${timer.name} is finished!`);
    
    // 3. Save History
    const history = data.history || [];
    const now = new Date();
    history.unshift({
        id: timer.id,
        name: timer.name,
        completedFully: true,
        duration: timer.originalMinutes,
        timestamp: Date.now(),
        hourOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        type: timer.type // 'focus' or 'pomodoro'
    });
    
    // 4. Update Stats
    const stats = data.stats || { dailyCount: 0, focusTime: 0, streak: 0 };
    stats.dailyCount++;
    stats.focusTime += timer.originalMinutes;
    stats.streak++; 
    
    // 5. Remove from active timers
    timers = timers.filter(t => t.id !== id);
    await chrome.storage.local.set({ timers, history, stats });
    
    updateBadge();
    
    // 6. Check Sequence
    if (timer.type === 'pomodoro' && data.pomodoroSequence && data.pomodoroSequence.active) {
        await advancePomodoroSequence(id);
    }
  }
});

function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title,
        message: message,
        priority: 2
    });
}

async function updateBadge() {
    const data = await chrome.storage.local.get(['timers']);
    const count =  data.timers ? data.timers.length : 0;
    if (count > 0) {
        chrome.action.setBadgeText({text: count.toString()});
        chrome.action.setBadgeBackgroundColor({color: '#E056FD'});
    } else {
        chrome.action.setBadgeText({text: ''});
    }
}
