# ✨ Chrono Sphere

A gentle, customizable timer Chrome/Vivaldi extension with holographic aesthetics.

![Version](https://img.shields.io/badge/version-1.0-9b87f5)
![Manifest](https://img.shields.io/badge/manifest-v3-ff69b4)

## Features

- 🍅 **Pomodoro Timer** - 25 minute focus sessions
- ☕ **Short Break** - 5 minute quick breaks
- 🌙 **Long Break** - 15 minute extended breaks
- 🎯 **Deep Work** - 52 minute intensive sessions
- ⏱️ **Custom Timers** - Set any duration with custom names
- 🔔 **Multiple Sounds** - Chime, water, alarm, or upload your own
- 💬 **Custom Notifications** - Personalized completion messages
- 🌙 **Dark Mode** - Beautiful periwinkle/pink gradient theme

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open your browser's extensions page:
   - **Vivaldi**: `vivaldi://extensions`
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `Chrono-Sphere` folder

### Usage

1. Click the Chrono Sphere icon in your browser toolbar
2. Choose a preset or create a custom timer
3. Optionally customize the notification sound and message
4. Click **Start Timer**
5. Timer runs in the background - close the popup anytime!

## File Structure

```
Chrono-Sphere/
├── manifest.json       # Extension configuration
├── popup.html          # Main popup interface
├── popup.css           # Styling (dark mode theme)
├── popup.js            # Timer logic and UI
├── background.js       # Service worker for alarms
├── offscreen.html      # Audio playback document
├── offscreen.js        # Sound player
├── icons/
│   ├── icon16.png      # Toolbar icon
│   ├── icon48.png      # Extension page icon
│   └── icon128.png     # Store/large icon
└── sounds/
    ├── chime.wav       # Gentle bell sound
    ├── water.wav       # Water/bubble sound
    └── alarm.wav       # Sharp beep alarm
```

## Customization

### Custom Sounds

Replace the WAV files in `sounds/` with your own audio files. Keep the same filenames:
- `chime.wav`
- `water.wav`
- `alarm.wav`

Or use the built-in custom upload feature to add any audio file!

### Regenerating Sounds

```bash
node generate-sounds.js
```

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Periwinkle | `#9b87f5` | Primary accent |
| Bright Pink | `#ff69b4` | Secondary accent |
| Sunset Orange | `#ff8c42` | Timer display |
| Sunset Yellow | `#ffd23f` | Timer display |
| Dark BG | `#0a0a0f` | Background |
| Dark Card | `#1a1a24` | Card backgrounds |

## Permissions

- **storage** - Save timer state and preferences
- **alarms** - Schedule timer completion events
- **offscreen** - Play audio when popup is closed
- **notifications** - Show completion notifications

## License

MIT License - Feel free to modify and share!

---

Made with 💜 and ✨
