class PomodoroUI {
  constructor() {
    this.container = document.getElementById('activeTimerContainer');
    // Pre-bind context
    this.render = this.render.bind(this);
  }

  show() {
    this.container.classList.remove('hidden');
    document.getElementById('quickStartSection').classList.add('hidden');
    document.querySelector('.custom-timer-section').classList.add('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
    document.getElementById('quickStartSection').classList.remove('hidden');
    document.querySelector('.custom-timer-section').classList.remove('hidden');
  }

  render(timer, sequenceState) {
    if (!timer) return;
    
    // Determine phase info
    const isSequence = timer.sequenceTimer;
    const currentPhase = isSequence ? (timer.name.includes('Break') ? 'break' : 'work') : 'work';
    const phaseLabel = timer.name; // "Pomodoro", "Short Break", etc.
    
    // Calculate progress
    const totalSeconds = timer.totalSeconds;
    const remaining = timer.remainingSeconds;
    const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
    
    // Colors based on phase
    let ringColorClass = 'work';
    if (timer.name.includes('Short')) ringColorClass = 'short-break';
    if (timer.name.includes('Long')) ringColorClass = 'long-break';

    // Sequence Dots (Mock logic if no active sequence, or real if passed)
    let dotsHTML = '';
    if (isSequence && sequenceState) {
        const totalSteps = sequenceState.steps.length;
        const currentStep = sequenceState.currentStep;
        
        // Generate dots: filled for past, active for current, empty for future
        // We really only want to track "Work" sessions for the classic 4-dot view, 
        // but for now let's just show simple progress or a simplified view
        // The prompt asked for "Round 1 of 4" and dots.
        // Let's assume standard Pomodoro sequence: Work, Short, Work, Short, Work, Short, Work, Long
        // That's 4 work sessions.
        
        // Simple dot logic: 1 dot per Work session completed + current
        const workSessions = sequenceState.steps.filter(s => s === 'pomodoro').length;
        const currentWorkCount = sequenceState.steps.slice(0, currentStep + 1).filter(s => s === 'pomodoro').length;
        
        dotsHTML = '<div class="sequence-dots">';
        for (let i = 0; i < workSessions; i++) {
            let className = 'dot';
            if (i < currentWorkCount - 1) className += ' completed'; // Past
            else if (i === currentWorkCount - 1 && currentPhase === 'work') className += ' active'; // Current
            dotsHTML += `<span class="${className}"></span>`;
        }
        dotsHTML += '</div>';
    }

    const html = `
      <div class="pomodoro-phase-header ${ringColorClass}">
        <div class="phase-info">
          <span class="phase-type">${phaseLabel}</span>
          ${isSequence ? `<span class="phase-separator">•</span><span class="round-counter">Round ${Math.ceil((sequenceState?.currentStep + 1)/2) || 1} of 4</span>` : ''}
        </div>
        ${dotsHTML}
      </div>

      <div class="timer-ring">
         <svg class="progress-ring" width="220" height="220">
           <circle class="timer-ring-bg" cx="110" cy="110" r="100"></circle>
           <circle 
             class="timer-ring-progress ${ringColorClass}" 
             cx="110" 
             cy="110" 
             r="100"
             stroke-dasharray="${2 * Math.PI * 100}"
             stroke-dashoffset="${2 * Math.PI * 100 * (1 - progress)}"
           ></circle>
         </svg>
         <div class="timer-display-content">
            <div class="timer-icon">${this.getIconForPhase(timer.name)}</div>
            <div class="timer-time">${this.formatTime(remaining)}</div>
         </div>
      </div>

      <div class="pomodoro-controls">
        <button id="pauseBtn" class="control-btn pause" data-id="${timer.id}">
          <span class="icon">${timer.isRunning ? '⏸️' : '▶️'}</span>
          <span class="label">${timer.isRunning ? 'Pause' : 'Resume'}</span>
        </button>
        
        ${isSequence ? `
        <button id="skipBtn" class="control-btn skip" data-id="${timer.id}">
          <span class="icon">⏭️</span>
          <span class="label">Skip</span>
        </button>
        ` : ''}
        
        <button id="endBtn" class="control-btn end destructive" data-id="${timer.id}">
          <span class="icon">🗑️</span>
          <span class="label">End</span>
        </button>
      </div>

      <div class="next-phase-preview">
        ${this.getNextPhaseText(timer, sequenceState)}
      </div>
    `;

    this.container.innerHTML = html;
    
    // Bind buttons
    this.container.querySelector('#pauseBtn').onclick = () => window.pauseTimer(timer.id);
    this.container.querySelector('#endBtn').onclick = () => window.deleteTimer(timer.id);
    if (isSequence) {
        this.container.querySelector('#skipBtn').onclick = () => window.skipPhase(timer.id);
    }
  }

  getIconForPhase(name) {
      if (name.includes('Short')) return '☕';
      if (name.includes('Long')) return '🌴';
      if (name.includes('Deep')) return '🎯';
      return '🍅';
  }

  getNextPhaseText(timer, sequence) {
      if (!sequence) return 'Timer active';
      const nextStepIndex = sequence.currentStep + 1;
      if (nextStepIndex >= sequence.steps.length) return 'Sequence finishing soon';
      
      const nextType = sequence.steps[nextStepIndex];
      const duration = this.getDurationForType(nextType); // This helper might need data access
      const niceName = nextType === 'shortBreak' ? 'Short Break' : nextType === 'longBreak' ? 'Long Break' : 'Work';
      
      return `Next: <strong>${niceName}</strong> (${duration}min)`;
  }
  
  // Quick helper since we don't have full config access here easily without passing it in
  getDurationForType(type) {
      const defaults = { pomodoro: 25, shortBreak: 5, longBreak: 15, deepWork: 52 };
      return defaults[type] || 25;
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

// Export for use in popup.js
window.PomodoroUI = PomodoroUI;
