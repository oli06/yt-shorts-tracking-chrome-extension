// Initialize storage with default values if not exists
chrome.runtime.onInstalled.addListener(() => {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['shortsHistory', 'shortsUrls', 'shortsSkipped', 'redirectThreshold'], (result) => {
    if (!result.shortsHistory) {
      chrome.storage.local.set({
        shortsHistory: {},
        shortsUrls: {},
        shortsSkipped: {},
        skippedUrls: {}, // Add skipped URLs tracking
        redirectThreshold: 5, // Default threshold for number of shorts
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
  } else if (request.type === 'START_SHORTS_SESSION') {
    startShortsSession();
  } else if (request.type === 'END_SESSION') {
    currentSessionShortsCount = 0;
  } else if (request.type === 'RESET_BADGE') {
    chrome.action.setBadgeText({ text: '' });
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
  ], (result) => {
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
    }, () => {
      // Update the badge with the new count
      updateBadge(count);
    });

    // Check count-based redirect threshold
    if (count === result.redirectThreshold) {
      showNotification('count');
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
  chrome.action.openPopup().catch(() => {});

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

let currentSessionShortsCount = 0;

// Check and handle day changes
async function checkAndHandleDayChange() {
  const today = new Date().toISOString().split('T')[0];
  
  chrome.storage.local.get(['lastActiveDate'], (result) => {
    const lastActiveDate = result.lastActiveDate;
    
    // If it's a new day or no last active date exists
    if (!lastActiveDate || lastActiveDate !== today) {
      chrome.storage.local.set({
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

  this.currentSessionShortsCount = 0;
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