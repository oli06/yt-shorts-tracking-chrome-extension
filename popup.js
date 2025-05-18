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
let lastWatchedCount = 0;
let lastSkippedCount = 0;

// Format time in MM:SS
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Update the popup with current statistics
function updateStats() {
  browser.storage.local.get(['shortsHistory', 'shortsSkipped'], (result) => {
    const today = formatDate(new Date());
    
    // Update today's counts
    document.getElementById('todayCount').textContent = (result.shortsHistory || {})[today] || 0;
    document.getElementById('todaySkipped').textContent = (result.shortsSkipped || {})[today] || 0;
    
    // Initial chart updates
    updateWeeklyChart();
  });
}

// Reset statistics
async function resetStats() {
  browser.storage.local.set({
    shortsHistory: {},
    shortsUrls: {},
    shortsSkipped: {},
  }, () => {
    // Reset the badge to 0
    browser.runtime.sendMessage({ type: 'RESET_BADGE' });
    // Update the chart and counter
    updateStats();
  });
}

function isSafari() {
  const ua = navigator.userAgent;
  return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Firefox') && !ua.includes('Edg');
}

// Export statistics data
function exportStatistics() {
  browser.storage.local.get(['shortsHistory', 'shortsUrls', 'shortsSkipped', 'skippedUrls'], async (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    const shortsSkipped = result.shortsSkipped || {};
    const skippedUrls = result.skippedUrls || {};
    
    // Create a structured object for export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalDays: Object.keys(shortsHistory).length,
        totalShortsWatched: Object.values(shortsHistory).reduce((sum, count) => sum + count, 0),
        totalShortsSkipped: Object.values(shortsSkipped).reduce((sum, count) => sum + count, 0),
      },
      dailyStats: Object.entries(shortsHistory).map(([date, count]) => {
        return {
          date: date,
          formattedDate: new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }),
          watched: count,
          skipped: shortsSkipped[date] || 0,
          watchedUrls: shortsUrls[date] || [],
          skippedUrls: skippedUrls[date] || []
        };
      }).sort((a, b) => b.date.localeCompare(a.date)) // Sort by date descending
    };
    
    // Create and download the file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });

    if (isSafari()) {
  //     browser.notification.create({
  //       type: "basic",
  // iconUrl: "icons/icon1282.png",
  // title: "Notification",
  // message: "Hello from your Safari extension!"
  //   });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtube-shorts-stats-${formatDateExport(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });
}

// Listen for messages from content script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SHORTS_VIEWED' || request.type === 'SHORTS_SKIPPED') {
    // Update the stats when a new Shorts video is viewed or skipped
    updateStats();
  }
});

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Add settings button click handler
  document.getElementById('settingsButton').addEventListener('click', function() {
    browser.tabs.create({ url: browser.runtime.getURL('settings.html') });
  });
  
  // Add other event listeners
  document.getElementById('resetButton').addEventListener('click', resetStats);
  document.getElementById('exportButton').addEventListener('click', exportStatistics);
  
  // Listen for storage changes
  browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      // Update stats and weekly chart if counts changed
      if (changes.shortsHistory || changes.shortsSkipped) {
        updateWeeklyChart();
      }
    }
  });
  
  // Initial update
  updateStats();
});

// Update weekly stats chart
function updateWeeklyChart() {
  browser.storage.local.get(['shortsHistory', 'shortsSkipped'], (result) => {
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