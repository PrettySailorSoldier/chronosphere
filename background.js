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
  } else if (msg.type === 'stopTimer') {
    handleStopTimer(msg.id);
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
  
  // Tab Freeze Trigger
  if (timer.name.toLowerCase().includes('break')) {
      // Unfreeze if break?
      // Optional: Logic to unfreeze
  } else {
      // Focus timer
      const res = await freezeManager.freezeTabs();
      if(res.count > 0) {
          showNotification('Tab Freeze Active', `Frozen ${res.count} tabs to save ~${res.savedMB}MB RAM.`);
      }
  }
  
  updateBadge();
}

async function handleStopTimer(id) {
    await chrome.alarms.clear(id);
    updateBadge();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Alarm fired = Timer Done
  const id = alarm.name;
  
  const data = await chrome.storage.local.get(['timers', 'history', 'stats', 'sound', 'volume']);
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
        type: 'focus' // simplified, could infer
    });
    
    // 4. Update Stats
    const stats = data.stats || { dailyCount: 0, focusTime: 0, streak: 0 };
    stats.dailyCount++;
    stats.focusTime += timer.originalMinutes;
    stats.streak++; // Simple increment
    
    // 5. Remove from active timers
    timers = timers.filter(t => t.id !== id);
    
    await chrome.storage.local.set({ timers, history, stats });
    
    updateBadge();
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
        chrome.action.setBadgeBackgroundColor({color: '#E8B4FA'});
    } else {
        chrome.action.setBadgeText({text: ''});
    }
}
