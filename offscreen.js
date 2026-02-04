// Listen for messages from background script
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'playSound') {
    playAudio(msg.source, msg.volume);
  }
});

function playAudio(source, volume) {
  const audio = new Audio(source);
  audio.volume = volume;
  audio.play().catch(error => console.warn("Audio playback failed:", error));
  
  // Optional: Clean up after playing
  audio.onended = () => {
    // Done
  };
}
