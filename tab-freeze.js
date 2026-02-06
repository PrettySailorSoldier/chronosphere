// Tab Freeze Manager
class TabFreezeManager {
  constructor() {
    this.whitelist = ['gmail.com', 'spotify.com']; // Default whitelist
    this.frozenTabs = [];
    this.enabled = true;
  }

  async loadSettings() {
    const result = await chrome.storage.local.get(['tabFreezeWhitelist', 'tabFreezeEnabled']);
    this.whitelist = result.tabFreezeWhitelist || this.whitelist;
    this.enabled = result.tabFreezeEnabled !== false; // Default true
  }

  async saveSettings() {
    await chrome.storage.local.set({
      tabFreezeWhitelist: this.whitelist,
      tabFreezeEnabled: this.enabled
    });
  }

  isWhitelisted(url) {
    if (!url) return false;
    return this.whitelist.some(pattern => url.includes(pattern));
  }

  async getMemoryInfo() {
    try {
      if (chrome.system && chrome.system.memory) {
        const info = await chrome.system.memory.getInfo();
        return {
          total: info.capacity,
          available: info.availableCapacity,
          used: info.capacity - info.availableCapacity
        };
      }
    } catch (err) {
      console.log('Memory API not available:', err.message);
    }
    return null;
  }

  async freezeTabs() {
    if (!this.enabled) return { count: 0, savedMB: 0 };

    const beforeMemory = await this.getMemoryInfo();
    const allTabs = await chrome.tabs.query({});
    const activeTabQuery = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTabId = activeTabQuery[0]?.id;

    const toFreeze = allTabs.filter(tab =>
      tab.id !== activeTabId &&
      !tab.discarded &&
      !tab.pinned &&
      tab.url &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('chrome-extension://') &&
      !this.isWhitelisted(tab.url)
    );

    let frozenCount = 0;
    for (const tab of toFreeze) {
      try {
        await chrome.tabs.discard(tab.id);
        this.frozenTabs.push(tab.id);
        frozenCount++;
      } catch (err) {
        console.log('Could not freeze tab:', tab.id, err.message);
      }
    }

    const afterMemory = await this.getMemoryInfo();
    let savedMB = 0;
    
    if (beforeMemory && afterMemory) {
      savedMB = Math.round((beforeMemory.used - afterMemory.used) / 1024 / 1024);
    } else {
      // Estimate ~100MB per tab
      savedMB = Math.round(frozenCount * 100);
    }

    return {
      count: frozenCount,
      savedMB: Math.max(0, savedMB),
      before: beforeMemory,
      after: afterMemory
    };
  }

  async unfreezeTabs() {
    // Tabs auto-unfreeze when clicked, but we can pre-reload important ones
    const importantPatterns = this.whitelist.slice(0, 3); // Top 3 whitelisted
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      if (this.frozenTabs.includes(tab.id) &&
          importantPatterns.some(pattern => tab.url && tab.url.includes(pattern))) {
        try {
          await chrome.tabs.reload(tab.id);
        } catch (err) {
          console.log('Could not reload tab:', tab.id, err.message);
        }
      }
    }

    this.frozenTabs = [];
  }

  addToWhitelist(domain) {
    if (domain && !this.whitelist.includes(domain)) {
      this.whitelist.push(domain);
      this.saveSettings();
    }
  }

  removeFromWhitelist(domain) {
    this.whitelist = this.whitelist.filter(d => d !== domain);
    this.saveSettings();
  }
}

// Export for use in other files
const tabFreezer = new TabFreezeManager();
