// Initialize storage with default values if not exists
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['shortsHistory', 'shortsUrls'], (result) => {
    if (!result.shortsHistory) {
      chrome.storage.local.set({
        shortsHistory: {},
        shortsUrls: {},
        lastNotificationDate: null
      });
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SHORTS_VIEWED') {
    updateShortsCount(request.url);
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RESET_BADGE') {
    chrome.action.setBadgeText({ text: '0' });
    chrome.action.setBadgeBackgroundColor({ color: '#666666' });
  } else if (message.type === 'TEST_NOTIFICATION') {
    // Request notification permission if not already granted
    chrome.notifications.getPermissionLevel(level => {
      console.log("granted? level", level)
      if (level === 'granted') {
        chrome.notifications.create("somerandomid", 
            {
          type: 'basic',
          iconUrl: "icons/icon48.png",
          title: 'YouTube Shorts Tracker',
          message: 'This is a test notification to verify that notifications are working properly.',
          priority: 1,
          requireInteraction: true
        }, function(id) { console.log("Last error:", chrome.runtime.lastError);}
        );
      } else {
        // If permission not granted, show a console message
        console.log('Notification permission not granted. Please enable notifications in Chrome settings.');
      }
    });
  }
});

// Update the shorts count for today
async function updateShortsCount(url) {
  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(['shortsHistory', 'shortsUrls', 'lastNotificationDate'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    const count = (shortsHistory[today] || 0) + 1;
    
    shortsHistory[today] = count;
    
    // Store the URL
    if (!shortsUrls[today]) {
      shortsUrls[today] = [];
    }
    shortsUrls[today].push(url);
    
    chrome.storage.local.set({
      shortsHistory: shortsHistory,
      shortsUrls: shortsUrls,
      lastNotificationDate: result.lastNotificationDate
    }, () => {
      // Update the badge with the new count
      updateBadge(count);
    });

  console.log("lastnotificationdate", result.lastNotificationDate)
    // Check if we need to show a notification
    console.log("count", count)
    if (count === 10) {
      showNotification();
      chrome.storage.local.set({ lastNotificationDate: today });
    }
  });
}

// Update the badge on the extension icon
function updateBadge(count) {
  // Set the badge text
  chrome.action.setBadgeText({ text: count.toString() });
  
  // Set the badge background color
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
}

// Show notification when reaching 10 shorts
function showNotification() {
  console.log('Showing notification');

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'YouTube Shorts Limit Reached',
    message: 'You have watched 10 Shorts today! Consider taking a break.'
  });

  // Try to open the popup
  chrome.action.openPopup().catch(error => {
    console.log('C^ould not open popup:', error);
  });

  // Check if redirect is enabled
  chrome.storage.local.get(['enableRedirect'], function(result) {
    if (result.enableRedirect) {
      // Get the current tab and remove it, then create a new one
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          // Remove the current tab
          chrome.tabs.remove(tabs[0].id, function() {
            // Create a new tab with r/GetDisciplined
            chrome.tabs.create({ url: 'https://www.reddit.com/r/GetDisciplined' });
          });
        }
      });
    }
  });
}

// Initialize badge on startup
chrome.storage.local.get(['shortsHistory'], (result) => {
  const shortsHistory = result.shortsHistory || {};
  const today = new Date().toISOString().split('T')[0];
  const count = shortsHistory[today] || 0;
  updateBadge(count);
}); 