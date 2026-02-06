// Stats page logic
let currentPeriod = 'week';

document.addEventListener('DOMContentLoaded', async () => {
  await loadOverview();
  await loadChart();
  await loadGoal();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'popup.html';
  });

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      await loadChart();
    });
  });

  document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
  document.getElementById('exportBtn').addEventListener('click', exportData);
}

async function loadOverview() {
  try {
    const result = await chrome.storage.local.get(['history', 'stats']);
    const history = result.history || [];
    const stats = result.stats || { streak: 0 };

    // Total sessions
    document.getElementById('totalSessions').textContent = history.length;

    // Total focus time
    const totalSeconds = history.reduce((sum, item) => sum + item.duration, 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMins = Math.floor((totalSeconds % 3600) / 60);
    document.getElementById('totalFocusTime').textContent =
      totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`;

    // Average session
    const avgSeconds = history.length > 0 ? totalSeconds / history.length : 0;
    document.getElementById('avgSession').textContent = `${Math.round(avgSeconds / 60)}m`;

    // Streak
    document.getElementById('currentStreak').textContent = stats.streak || 0;
  } catch (err) {
    console.error('Failed to load overview:', err);
  }
}

async function loadChart() {
  try {
    const result = await chrome.storage.local.get(['history']);
    const history = result.history || [];
    const container = document.getElementById('activityChart');

    let data;
    let labels;

    if (currentPeriod === 'week') {
      data = getWeekData(history);
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else {
      data = getMonthData(history);
      labels = data.labels;
      data = data.values;
    }

    const maxValue = Math.max(...data, 1);

    container.innerHTML = data.map((value, i) => {
      const height = (value / maxValue) * 100;
      const minutes = Math.round(value / 60);
      return `
        <div class="chart-bar-wrapper">
          <div class="chart-value">${minutes}m</div>
          <div class="bar-container">
            <div class="chart-bar" style="height: ${Math.max(height, 3)}%"></div>
          </div>
          <div class="chart-label">${labels[i]}</div>
        </div>
      `;
    }).join('');

    // Find best day
    updateBestDay(history);
  } catch (err) {
    console.error('Failed to load chart:', err);
  }
}

function getWeekData(history) {
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Adjust for Monday start
  startOfWeek.setDate(now.getDate() - diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const weekData = [0, 0, 0, 0, 0, 0, 0];

  history.forEach(item => {
    const itemDate = new Date(item.completedAt);
    if (itemDate >= startOfWeek) {
      let dayIndex = itemDate.getDay() - 1;
      if (dayIndex < 0) dayIndex = 6; // Sunday
      weekData[dayIndex] += item.duration;
    }
  });

  return weekData;
}

function getMonthData(history) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Group into weeks for display
  const weeks = [];
  const labels = [];
  let weekTotal = 0;
  let currentWeek = 1;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), d);
    const dayHistory = history.filter(item => {
      const itemDate = new Date(item.completedAt);
      return itemDate.toDateString() === date.toDateString();
    });

    weekTotal += dayHistory.reduce((sum, item) => sum + item.duration, 0);

    if (date.getDay() === 0 || d === daysInMonth) {
      weeks.push(weekTotal);
      labels.push(`W${currentWeek}`);
      weekTotal = 0;
      currentWeek++;
    }
  }

  return { values: weeks, labels };
}

function updateBestDay(history) {
  const dayTotals = {};

  history.forEach(item => {
    const date = new Date(item.completedAt).toDateString();
    dayTotals[date] = (dayTotals[date] || 0) + item.duration;
  });

  let bestDay = null;
  let bestTotal = 0;

  for (const [date, total] of Object.entries(dayTotals)) {
    if (total > bestTotal) {
      bestTotal = total;
      bestDay = date;
    }
  }

  const bestDayEl = document.getElementById('bestDay');
  if (bestDay && bestTotal > 0) {
    const hours = Math.floor(bestTotal / 3600);
    const mins = Math.floor((bestTotal % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const dateObj = new Date(bestDay);
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    document.getElementById('bestDayValue').textContent = `${dateStr} - ${timeStr} focused`;
    bestDayEl.style.display = 'flex';
  } else {
    bestDayEl.style.display = 'none';
  }
}

async function loadGoal() {
  try {
    const result = await chrome.storage.local.get(['history', 'dailyGoal']);
    const history = result.history || [];
    const dailyGoal = result.dailyGoal || 60; // Default 60 minutes

    // Calculate today's progress
    const today = new Date().toDateString();
    const todayHistory = history.filter(item =>
      new Date(item.completedAt).toDateString() === today
    );
    const todayMinutes = Math.round(todayHistory.reduce((sum, item) => sum + item.duration, 0) / 60);

    // Update UI
    document.getElementById('goalInput').value = dailyGoal;
    document.getElementById('goalTarget').textContent = dailyGoal;
    document.getElementById('goalCurrent').textContent = `${todayMinutes}m`;

    const progress = Math.min((todayMinutes / dailyGoal) * 100, 100);
    document.getElementById('goalProgress').style.width = `${progress}%`;
  } catch (err) {
    console.error('Failed to load goal:', err);
  }
}

async function saveGoal() {
  const input = document.getElementById('goalInput');
  const value = parseInt(input.value);

  if (isNaN(value) || value < 1 || value > 480) {
    showToast('Goal must be 1-480 minutes');
    return;
  }

  try {
    await chrome.storage.local.set({ dailyGoal: value });
    await loadGoal();
    showToast('Goal saved! 🎯');
  } catch (err) {
    console.error('Failed to save goal:', err);
    showToast('Failed to save goal');
  }
}

async function exportData() {
  try {
    const result = await chrome.storage.local.get(['history', 'stats', 'settings', 'sequences']);

    const exportData = {
      exportedAt: new Date().toISOString(),
      history: result.history || [],
      stats: result.stats || {},
      settings: result.settings || {},
      sequences: result.sequences || []
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chrono-sphere-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast('Data exported! 📥');
  } catch (err) {
    console.error('Failed to export:', err);
    showToast('Export failed');
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
