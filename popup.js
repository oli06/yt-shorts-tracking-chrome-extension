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

// Format time in mm:ss
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Update session timer
function updateSessionTimer() {
  chrome.runtime.sendMessage({ type: 'GET_SESSION_TIME' }, (response) => {
    if (response && response.sessionTime !== undefined) {
      document.getElementById('sessionTimer').textContent = formatTime(response.sessionTime);
    }
  });
}

// Update the popup with current statistics
function updateStats() {
  chrome.storage.local.get(['shortsHistory', 'shortsSkipped'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsSkipped = result.shortsSkipped || {};
    const today = formatDate(new Date());
    
    // Update today's counts
    document.getElementById('todayCount').textContent = shortsHistory[today] || 0;
    document.getElementById('todaySkipped').textContent = shortsSkipped[today] || 0;
    
    // Prepare data for the chart
    const dates = getLastSevenDays();
    const labels = dates.map(date => formatDateDisplay(date));
    const watchedData = dates.map(date => shortsHistory[formatDate(date)] || 0);
    const skippedData = dates.map(date => shortsSkipped[formatDate(date)] || 0);
    
    // Create or update the chart
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    if (weeklyChart) {
      weeklyChart.destroy();
    }
    
    weeklyChart = new Chart(ctx, {
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

// Reset statistics
async function resetStats() {
  const dates = getLastSevenDays();
  const dateStrings = dates.map(date => formatDate(date));
  
  chrome.storage.local.get(['shortsHistory', 'shortsUrls', 'shortsSkipped'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    const shortsSkipped = result.shortsSkipped || {};
    
    // Clear all data for the last 7 days
    dateStrings.forEach(date => {
      delete shortsHistory[date];
      delete shortsUrls[date];
      delete shortsSkipped[date];
    });
    
    chrome.storage.local.set({
      shortsHistory: shortsHistory,
      shortsUrls: shortsUrls,
      shortsSkipped: shortsSkipped
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
document.getElementById('resetButton').addEventListener('click', resetStats);
document.getElementById('exportButton').addEventListener('click', exportStatistics);
document.getElementById('testNotificationButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TEST_NOTIFICATION' });
});

// Update stats when popup opens
document.addEventListener('DOMContentLoaded', function() {
  // Start timer update interval
  updateSessionTimer();
  setInterval(updateSessionTimer, 1000);
  
  // Load all settings
  chrome.storage.local.get(['enableRedirect', 'redirectThreshold', 'enableTimeBasedRedirect'], function(result) {
    // Set redirect checkbox
    document.getElementById('enableRedirect').checked = result.enableRedirect || false;
    
    // Set redirect threshold
    document.getElementById('redirectThreshold').value = result.redirectThreshold || 5;
    
    // Set time-based redirect checkbox
    document.getElementById('enableTimeBasedRedirect').checked = result.enableTimeBasedRedirect || false;
  });

  // Save redirect setting when changed
  document.getElementById('enableRedirect').addEventListener('change', function(e) {
    chrome.storage.local.set({ enableRedirect: e.target.checked });
  });

  // Save redirect threshold when changed
  document.getElementById('redirectThreshold').addEventListener('change', function(e) {
    const value = parseInt(e.target.value, 10);
    if (value >= 1 && value <= 100) {
      chrome.storage.local.set({ redirectThreshold: value });
    }
  });

  // Save time-based redirect setting when changed
  document.getElementById('enableTimeBasedRedirect').addEventListener('change', function(e) {
    chrome.storage.local.set({ enableTimeBasedRedirect: e.target.checked });
  });

  updateStats();
});