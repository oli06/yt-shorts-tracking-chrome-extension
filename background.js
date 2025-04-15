// Initialize storage with default values if not exists
chrome.runtime.onInstalled.addListener(() => {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['shortsHistory', 'shortsUrls', 'shortsSkipped', 'redirectThreshold', 'enableTimeBasedRedirect', 'sessionTimes'], (result) => {
    if (!result.shortsHistory) {
      chrome.storage.local.set({
        shortsHistory: {},
        shortsUrls: {},
        shortsSkipped: {},
        skippedUrls: {}, // Add skipped URLs tracking
        redirectThreshold: 5, // Default threshold for number of shorts
        enableTimeBasedRedirect: false, // Default time-based redirect setting
        shortsWatchTime: {}, // Track cumulative watch time per day
        sessionTimes: {}, // Track session times per day
        lastActiveDate: today // Add last active date tracking
      });
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SHORTS_VIEWED') {
    handleShortsViewed(request.url);
  } else if (request.type === 'SHORTS_SKIPPED') {
    handleShortsSkipped(request.url);
  } else if (request.type === 'UPDATE_WATCH_TIME') {
    updateWatchTime(request.seconds);
  } else if (request.type === 'START_SHORTS_SESSION') {
    startShortsSession();
  } else if (request.type === 'END_SESSION') {
    endShortsSession();
  } else if (request.type === 'GET_SESSION_TIME') {
    chrome.storage.local.get(['currentSessionTime'], (result) => {
      sendResponse({ sessionTime: result.currentSessionTime || 0 });
    });
    return true;
  } else if (request.type === 'RESET_BADGE') {
    chrome.action.setBadgeText({ text: '' });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TEST_NOTIFICATION') {
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

// Update the skipped shorts count for today
async function updateSkippedCount(url) {
  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(['shortsSkipped'], (result) => {
    const shortsSkipped = result.shortsSkipped || {};
    const count = (shortsSkipped[today] || 0) + 1;
    
    shortsSkipped[today] = count;
    
    chrome.storage.local.set({
      shortsSkipped: shortsSkipped
    });
  });
}

// Update the shorts count for today
async function updateShortsCount(url) {
  await checkAndHandleDayChange();
  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get([
    'shortsHistory', 
    'shortsUrls', 
    'redirectThreshold',
    'enableTimeBasedRedirect',
    'shortsWatchTime'
  ], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    const shortsWatchTime = result.shortsWatchTime || {};
    const count = (shortsHistory[today] || 0) + 1;
    
    // Update watch time
    if (!shortsWatchTime[today]) {
      shortsWatchTime[today] = 0;
    }
    shortsWatchTime[today] += 1; // Increment by 1 second
    
    shortsHistory[today] = count;
    
    // Store the URL
    if (!shortsUrls[today]) {
      shortsUrls[today] = [];
    }
    shortsUrls[today].push(url);
    
    chrome.storage.local.set({
      shortsHistory: shortsHistory,
      shortsUrls: shortsUrls,
      shortsWatchTime: shortsWatchTime
    }, () => {
      // Update the badge with the new count
      updateBadge(count);
    });

    // Check count-based redirect threshold
    if (count === result.redirectThreshold) {
      showNotification('count');
    }

    // Check time-based redirect (3 minutes = 180 seconds)
    if (result.enableTimeBasedRedirect && shortsWatchTime[today] >= 180) {
      showNotification('time');
      chrome.storage.local.set({ 
        shortsWatchTime: { ...shortsWatchTime, [today]: 0 } // Reset watch time for today
      });
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

// Show notification when reaching limits
function showNotification(type) {
  console.log('Showing notification');

  const message = type === 'count' 
    ? `You have watched ${chrome.storage.local.get(['redirectThreshold'], (result) => result.redirectThreshold)} Shorts today! Consider taking a break.`
    : 'You have spent 3 minutes watching Shorts today! Consider taking a break.';

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon1282.png',
    title: 'YouTube Shorts Limit Reached',
    message: message
  });

  // Try to open the popup
  chrome.action.openPopup().catch(error => {
    console.log('Could not open popup:', error);
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

// Update watch time for today
async function updateWatchTime(seconds) {
  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(['shortsWatchTime', 'enableTimeBasedRedirect', 'currentSessionTime'], (result) => {
    const shortsWatchTime = result.shortsWatchTime || {};
    const currentSessionTime = (result.currentSessionTime || 0) + seconds;
    
    if (!shortsWatchTime[today]) {
      shortsWatchTime[today] = 0;
    }
    
    shortsWatchTime[today] += seconds;
    
    chrome.storage.local.set({
      shortsWatchTime: shortsWatchTime,
      currentSessionTime: currentSessionTime
    });

    // Check if we've hit the 3-minute threshold
    if (result.enableTimeBasedRedirect && shortsWatchTime[today] >= 180) {
      showNotification('time');
    }
  });
}

let currentSessionShortsCount = 0;

// Check and handle day changes
async function checkAndHandleDayChange() {
  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(['lastActiveDate'], (result) => {
    const lastActiveDate = result.lastActiveDate;
    
    // If it's a new day or no last active date exists
    if (!lastActiveDate || lastActiveDate !== today) {
      // Reset session time
      chrome.storage.local.set({
        currentSessionTime: 0,
        lastActiveDate: today
      });
      
      // Clear badge
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

// Modify startShortsSession to include day change check
function startShortsSession() {
  checkAndHandleDayChange();
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  chrome.storage.local.set({ sessionStartTime: timestamp });
}

// Handle shorts viewed
function handleShortsViewed(url) {
  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(['shortsHistory', 'shortsUrls', 'enableRedirect', 'redirectThreshold'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = result.shortsUrls || {};
    
    // Update today's history
    if (!shortsHistory[today]) {
      shortsHistory[today] = 0;
    }
    shortsHistory[today]++;
    
    // Update today's URLs
    if (!shortsUrls[today]) {
      shortsUrls[today] = [];
    }
    shortsUrls[today].push(url);
    
    // Update storage
    chrome.storage.local.set({
      shortsHistory: shortsHistory,
      shortsUrls: shortsUrls
    });
    
    // Update badge
    chrome.action.setBadgeText({ text: shortsHistory[today].toString() });
    
    // Increment session shorts count and check for redirect
    currentSessionShortsCount++;
    if (result.enableRedirect && currentSessionShortsCount >= (result.redirectThreshold || 5)) {
      showNotification('count');
      currentSessionShortsCount = 0; // Reset count after redirect
    }
  });
}

// End the current shorts session
function endShortsSession() {
  chrome.storage.local.set({
    isWatchingShorts: false,
    currentSessionTime: 0
  });
  currentSessionShortsCount = 0;
}

// Handle shorts skipped
function handleShortsSkipped(url) {
  checkAndHandleDayChange();
  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(['shortsSkipped', 'skippedUrls'], (result) => {
    const shortsSkipped = result.shortsSkipped || {};
    const skippedUrls = result.skippedUrls || {};
    
    // Update today's skipped count
    if (!shortsSkipped[today]) {
      shortsSkipped[today] = 0;
    }
    shortsSkipped[today]++;
    
    // Update today's skipped URLs
    if (!skippedUrls[today]) {
      skippedUrls[today] = [];
    }
    skippedUrls[today].push(url);
    
    // Update storage
    chrome.storage.local.set({
      shortsSkipped: shortsSkipped,
      skippedUrls: skippedUrls
    });
  });
}

// Initialize badge on startup
chrome.storage.local.get(['shortsHistory'], (result) => {
  const shortsHistory = result.shortsHistory || {};
  const today = new Date().toISOString().split('T')[0];
  const count = shortsHistory[today] || 0;
  updateBadge(count);
}); 