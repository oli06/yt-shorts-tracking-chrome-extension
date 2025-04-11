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

// Update the popup with current statistics
function updateStats() {
  chrome.storage.local.get(['shortsHistory'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const today = formatDate(new Date());
    
    // Update today's count
    document.getElementById('todayCount').textContent = shortsHistory[today] || 0;
    
    // Prepare data for the chart
    const dates = getLastSevenDays();
    const labels = dates.map(date => formatDateDisplay(date));
    const data = dates.map(date => shortsHistory[formatDate(date)] || 0);
    
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
          data: data,
          backgroundColor: 'rgba(255, 0, 0, 0.5)',
          borderColor: 'rgb(255, 0, 0)',
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
            display: false
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
  
  chrome.storage.local.get(['shortsHistory', 'shortsUrls'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    
    // Clear all data for the last 7 days
    dateStrings.forEach(date => {
      delete shortsHistory[date];
      delete shortsUrls[date];
    });
    
    chrome.storage.local.set({
      shortsHistory: shortsHistory,
      shortsUrls: shortsUrls
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
  chrome.storage.local.get(['shortsHistory', 'shortsUrls'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    
    // Create a structured object for export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalDays: Object.keys(shortsHistory).length,
        totalShorts: Object.values(shortsHistory).reduce((sum, count) => sum + count, 0)
      },
      dailyStats: Object.entries(shortsHistory).map(([date, count]) => ({
        date: date,
        formattedDate: new Date(date).toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }),
        count: count,
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
  if (request.type === 'SHORTS_VIEWED') {
    // Update the stats when a new Shorts video is viewed
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
document.addEventListener('DOMContentLoaded', updateStats);