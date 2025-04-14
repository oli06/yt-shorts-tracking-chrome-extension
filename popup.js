// Format date to YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Format date for display (Weekday DD.MM)
function formatDateDisplay(date) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const day = weekdays[date.getDay()];
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${day} ${dayOfMonth}.${month}`;
}

// Format date for export (YYYY-MM-DD)
function formatDateExport(date) {
  return date.toISOString().split('T')[0];
}

// Get the last 7 days including today
function getLastSevenDays() {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date);
  }
  return dates;
}

let weeklyChart = null;
let sessionChart = null;
let lastWatchedCount = 0;
let lastSkippedCount = 0;

// Format time in MM:SS
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Update session timer
function updateSessionTimer() {
  chrome.runtime.sendMessage({ type: 'GET_SESSION_TIME' }, (response) => {
    if (response && response.sessionTime !== undefined) {
      document.getElementById('sessionTimer').textContent = formatTime(response.sessionTime);
    }
  });
}

// Convert session time to hour of the day (0-23)
function getHourFromTimestamp(timestamp) {
  const [hours] = timestamp.split(':').map(Number);
  return hours;
}

// Convert duration from seconds to minutes
function getDurationInMinutes(duration) {
  return Math.round(duration / 60);
}

// Update the popup with current statistics
function updateStats() {
  chrome.storage.local.get(['shortsHistory', 'shortsSkipped', 'sessionTimes', 'currentSessionTime'], (result) => {
    const today = formatDate(new Date());
    
    // Update today's counts
    document.getElementById('todayCount').textContent = (result.shortsHistory || {})[today] || 0;
    document.getElementById('todaySkipped').textContent = (result.shortsSkipped || {})[today] || 0;
    
    // Update session timer
    document.getElementById('sessionTimer').textContent = formatTime(result.currentSessionTime || 0);
    
    // Initial chart updates
    updateSessionChart();
    updateWeeklyChart();
  });
}

// Reset statistics
async function resetStats() {
  const dates = getLastSevenDays();
  const dateStrings = dates.map(date => formatDate(date));
  
  chrome.storage.local.get(['shortsHistory', 'shortsUrls', 'shortsSkipped', 'sessionTimes'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    const shortsSkipped = result.shortsSkipped || {};
    const sessionTimes = result.sessionTimes || {};
    
    // Clear all data for the last 7 days
    dateStrings.forEach(date => {
      delete shortsHistory[date];
      delete shortsUrls[date];
      delete shortsSkipped[date];
      delete sessionTimes[date];
    });
    
    chrome.storage.local.set({
      shortsHistory: shortsHistory,
      shortsUrls: shortsUrls,
      shortsSkipped: shortsSkipped,
      sessionTimes: sessionTimes,
      currentSessionTime: 0
    }, () => {
      // Reset the badge to 0
      chrome.runtime.sendMessage({ type: 'RESET_BADGE' });
      // Update the chart and counter
      updateStats();
    });
  });
}

// Export statistics data
function exportStatistics() {
  chrome.storage.local.get(['shortsHistory', 'shortsUrls', 'shortsSkipped'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    const shortsSkipped = result.shortsSkipped || {};
    
    // Create a structured object for export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalDays: Object.keys(shortsHistory).length,
        totalShortsWatched: Object.values(shortsHistory).reduce((sum, count) => sum + count, 0),
        totalShortsSkipped: Object.values(shortsSkipped).reduce((sum, count) => sum + count, 0)
      },
      dailyStats: Object.entries(shortsHistory).map(([date, count]) => ({
        date: date,
        formattedDate: new Date(date).toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }),
        watched: count,
        skipped: shortsSkipped[date] || 0,
        urls: shortsUrls[date] || []
      })).sort((a, b) => b.date.localeCompare(a.date)) // Sort by date descending
    };
    
    // Create and download the file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube-shorts-stats-${formatDateExport(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SHORTS_VIEWED' || request.type === 'SHORTS_SKIPPED') {
    // Update the stats when a new Shorts video is viewed or skipped
    updateStats();
  }
});

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Start timer update interval
  updateSessionTimer();
  setInterval(updateSessionTimer, 1000);
  
  // Add settings button click handler
  document.getElementById('settingsButton').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  });
  
  // Add other event listeners
  document.getElementById('resetButton').addEventListener('click', resetStats);
  document.getElementById('exportButton').addEventListener('click', exportStatistics);
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      // Update session timer display if currentSessionTime changed
      if (changes.currentSessionTime) {
        document.getElementById('sessionTimer').textContent = 
          formatTime(changes.currentSessionTime.newValue || 0);
      }
      
      // Update session chart only when sessionTimes changes
      if (changes.sessionTimes) {
        updateSessionChart();
      }
      
      // Update stats and weekly chart if counts changed
      if (changes.shortsHistory || changes.shortsSkipped) {
        updateWeeklyChart();
      }
    }
  });
  
  // Initial update
  updateStats();
});

// Update session distribution chart
function updateSessionChart() {
  chrome.storage.local.get(['sessionTimes'], (result) => {
    const sessionTimes = result.sessionTimes || {};
    const dates = getLastSevenDays();
    const datasets = [];
    
    // Create datasets for each day
    dates.forEach((date, index) => {
      const dateStr = formatDate(date);
      const dayData = sessionTimes[dateStr] || [];
      
      // Initialize array for 24 hours
      const hourlyData = new Array(24).fill(0);
      
      // Aggregate session durations by hour
      dayData.forEach(session => {
        if (typeof session === 'object') {
          const hour = getHourFromTimestamp(session.timestamp);
          const durationMinutes = getDurationInMinutes(session.duration);
          hourlyData[hour] += durationMinutes;
        }
      });
      
      // Add dataset for this day
      datasets.push({
        label: formatDateDisplay(date),
        data: hourlyData,
        borderColor: `hsl(${index * 360/7}, 70%, 50%)`,
        backgroundColor: `hsla(${index * 360/7}, 70%, 50%, 0.1)`,
        fill: true,
        tension: 0.4
      });
    });
    
    // Create or update session chart
    const ctx = document.getElementById('sessionChart').getContext('2d');
    if (sessionChart) {
      sessionChart.destroy();
    }
    
    sessionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Duration (minutes)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Hour of Day'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${Math.round(context.raw)} minutes`;
              }
            }
          }
        }
      }
    });
  });
}

// Update weekly stats chart
function updateWeeklyChart() {
  chrome.storage.local.get(['shortsHistory', 'shortsSkipped'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsSkipped = result.shortsSkipped || {};
    const dates = getLastSevenDays();
    
    // Prepare data for weekly chart
    const labels = dates.map(date => formatDateDisplay(date));
    const watchedData = dates.map(date => shortsHistory[formatDate(date)] || 0);
    const skippedData = dates.map(date => shortsSkipped[formatDate(date)] || 0);
    
    // Create or update weekly chart
    const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
    
    if (weeklyChart) {
      weeklyChart.destroy();
    }
    
    weeklyChart = new Chart(weeklyCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Shorts watched',
          data: watchedData,
          backgroundColor: 'rgba(255, 0, 0, 0.5)',
          borderColor: 'rgb(255, 0, 0)',
          borderWidth: 1
        },
        {
          label: 'Shorts skipped',
          data: skippedData,
          backgroundColor: 'rgba(128, 128, 128, 0.5)',
          borderColor: 'rgb(128, 128, 128)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            display: true
          }
        }
      }
    });
  });
}