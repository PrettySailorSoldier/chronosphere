chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'playSound') {
    handlePlaySound(message).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error('Sound playback error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep message channel open for async response
  } else if (message.action === 'stopSound') {
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
    sendResponse({ success: true });
  }
});

async function handlePlaySound(message) {
  const audioPlayer = document.getElementById('audioPlayer');
  
  // Use the URL provided by the background script
  if (message.soundUrl) {
    audioPlayer.src = message.soundUrl;
  } else {
    // Fallback just in case
    console.warn('No sound URL provided, using default chime');
    audioPlayer.src = chrome.runtime.getURL('sounds/chime.wav');
  }

  console.log('Playing sound:', audioPlayer.src, 'at volume:', message.volume);

  // Set volume from settings (0-100 to 0-1)
  const volume = (message.volume !== undefined ? message.volume : 70) / 100;
  audioPlayer.volume = Math.max(0, Math.min(1, volume));

  // Wait for audio to be ready before playing
  return new Promise((resolve, reject) => {
    const onCanPlay = () => {
      audioPlayer.removeEventListener('canplaythrough', onCanPlay);
      audioPlayer.removeEventListener('error', onError);
      audioPlayer.play()
        .then(resolve)
        .catch(reject);
    };

    const onError = (e) => {
      audioPlayer.removeEventListener('canplaythrough', onCanPlay);
      audioPlayer.removeEventListener('error', onError);
      console.error('Audio load error:', e);
      reject(new Error('Failed to load audio'));
    };

    // If already loaded, play immediately
    if (audioPlayer.readyState >= 3) {
      audioPlayer.play()
        .then(resolve)
        .catch(reject);
    } else {
      audioPlayer.addEventListener('canplaythrough', onCanPlay);
      audioPlayer.addEventListener('error', onError);
      audioPlayer.load();
    }
  });
}
