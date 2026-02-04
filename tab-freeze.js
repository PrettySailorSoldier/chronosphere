class TabFreezeManager {
  constructor() {
    this.whitelist = ['gmail.com', 'spotify.com', 'notion.so', 'youtube.com', 'meet.google.com'];
    this.enabled = true;
    this.loadSettings();
  }

  async loadSettings() {
    const result = await chrome.storage.local.get(['freezeWhitelist', 'freezeEnabled']);
    if (result.freezeWhitelist) this.whitelist = result.freezeWhitelist;
    if (result.freezeEnabled !== undefined) this.enabled = result.freezeEnabled;
  }

  async saveSettings() {
    await chrome.storage.local.set({
      freezeWhitelist: this.whitelist,
      freezeEnabled: this.enabled
    });
  }

  isWhitelisted(url) {
    if (!url) return true;
    return this.whitelist.some(domain => url.includes(domain));
  }

  addToWhitelist(domain) {
    if (!this.whitelist.includes(domain)) {
      this.whitelist.push(domain);
      this.saveSettings();
    }
  }

  removeFromWhitelist(domain) {
    this.whitelist = this.whitelist.filter(d => d !== domain);
    this.saveSettings();
  }

  async freezeTabs() {
    if (!this.enabled) return { count: 0, savedMB: 0 };

    // Get memory before (if permission allows roughly estimating)
    // Actually we can just count discarded tabs
    
    // Query all tabs
    const tabs = await chrome.tabs.query({});
    
    // Filter out active tabs, audible tabs, and whitelisted tabs
    const toFreeze = tabs.filter(tab => 
      !tab.active && 
      !tab.audible &&
      !this.isWhitelisted(tab.url)
    );

    let count = 0;
    for (const tab of toFreeze) {
      try {
        await chrome.tabs.discard(tab.id);
        count++;
      } catch (e) {
        console.warn('Failed to discard tab', tab.id);
      }
    }

    // Estimate ~100MB per tab
    return { count, savedMB: count * 100 };
  }
}

// Export for use in background.js (if using modules) or just global scope
globalThis.TabFreezeManager = TabFreezeManager;
