// Initialize storage with default values if not exists

browser.runtime.onInstalled.addListener(() => {
  onInstall();
});

function onInstall() {
  const today = new Date().toISOString().split('T')[0];
  browser.storage.local.get(['shortsHistory', 'shortsUrls', 'shortsSkipped', 'redirectThreshold'], (result) => {
    if (!result.shortsHistory) {
      browser.storage.local.set({
        shortsHistory: {},
        shortsUrls: {},
        shortsSkipped: {},
        skippedUrls: {}, // Add skipped URLs tracking
        redirectThreshold: 5, // Default threshold for number of shorts
        lastActiveDate: today, // Add last active date tracking
        enableRedirect: true, // Add enableRedirect flag
        customRedirectUrl: 'https://www.reddit.com/r/GetDisciplined', // Add customRedirectUrl
        currentSessionShortsCount: 0,
      });
    }
  });
}

// Listen for messages from content script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SHORTS_VIEWED') {
    handleShortsViewed(request.url);
  } else if (request.type === 'SHORTS_SKIPPED') {
    handleShortsSkipped(request.url);
  } else if (request.type === 'START_SHORTS_SESSION') {
    startShortsSession();
  } else if (request.type === 'END_SESSION') {
    browser.storage.local.set({ currentSessionShortsCount: 0 });
  } else if (request.type === 'RESET_BADGE') {
    browser.action.setBadgeText({ text: '' });
  }
});

// Update the skipped shorts count for today
async function updateSkippedCount(url) {
  const today = new Date().toISOString().split('T')[0];
  
  browser.storage.local.get(['shortsSkipped'], (result) => {
    const shortsSkipped = result.shortsSkipped || {};
    const count = (shortsSkipped[today] || 0) + 1;
    
    shortsSkipped[today] = count;
    
    browser.storage.local.set({
      shortsSkipped: shortsSkipped
    });
  });
}

// Update the badge on the extension icon
function updateBadge(count) {
  // Set the badge text
  browser.action.setBadgeText({ text: count.toString() });
  
  // Set the badge background color
  browser.action.setBadgeBackgroundColor({ color: '#FF0000' });
}

function isSafari() {
  const ua = navigator.userAgent;
  return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Firefox') && !ua.includes('Edg');
}

// Show notification when reaching limits
function showNotification(type) {
  const message = type === 'count' 
    ? `You have watched ${browser.storage.local.get(['redirectThreshold'], (result) => result.redirectThreshold)} Shorts today! Consider taking a break.`
    : 'You have spent 3 minutes watching Shorts today! Consider taking a break.';

    if(!isSafari()) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon1282.png',
        title: 'YouTube Shorts Limit Reached',
        message: message
      });
    }

  // Try to open the popup
  browser.action.openPopup().catch(() => {});

  // Check if redirect is enabled
  browser.storage.local.get(['enableRedirect', 'customRedirectUrl'], function(result) {
    if (result.enableRedirect) {
      // Get the current tab and remove it, then create a new one
      browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          // Remove the current tab
          browser.tabs.remove(tabs[0].id, function() {
            // Create a new tab with the custom redirect URL or default
            const redirectUrl = result.customRedirectUrl || 'https://www.reddit.com/r/GetDisciplined';
            browser.tabs.create({ url: redirectUrl });
          });
        }
      });
    }
  });
}

// Check and handle day changes
async function checkAndHandleDayChange() {
  const today = new Date().toISOString().split('T')[0];
  
  browser.storage.local.get(['lastActiveDate'], (result) => {
    const lastActiveDate = result.lastActiveDate;
    
    // If it's a new day or no last active date exists
    if (!lastActiveDate || lastActiveDate !== today) {
      browser.storage.local.set({
        lastActiveDate: today
      });
      
      // Clear badge
      browser.action.setBadgeText({ text: '' });
    }
  });
}

// Modify startShortsSession to include day change check
function startShortsSession() {
  checkAndHandleDayChange();

  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  browser.storage.local.set({ sessionStartTime: timestamp, currentSessionShortsCount: 0 });
}

// Handle shorts viewed
function handleShortsViewed(url) {
  const today = new Date().toISOString().split('T')[0];
  
  browser.storage.local.get(['shortsHistory', 'shortsUrls', 'enableRedirect', 'redirectThreshold', 'currentSessionShortsCount'], (result) => {
    const shortsHistory = result.shortsHistory || {};
    const shortsUrls = (typeof result.shortsUrls === 'object' && result.shortsUrls !== null) ? result.shortsUrls : {};
    let currentSessionShortsCount = result.currentSessionShortsCount || 0;
    
    // Update today's history
    if (!shortsHistory[today]) {
      shortsHistory[today] = 0;
    }
    shortsHistory[today] = shortsHistory[today] + 1;
    
    // Update today's URLs
    if (!Array.isArray(shortsUrls[today])) {
      shortsUrls[today] = [];
    }
    if (!shortsUrls[today]) {
      shortsUrls[today] = [];
    }
    shortsUrls[today].push(url);
    
    // Update badge
    browser.action.setBadgeText({ text: shortsHistory[today].toString() });
    
    // Increment session shorts count and check for redirect
    currentSessionShortsCount = currentSessionShortsCount + 1;
    if (result.enableRedirect && currentSessionShortsCount >= (result.redirectThreshold || 5)) {
      showNotification('count');
      currentSessionShortsCount = 0; // Reset count after redirect
    }

    // Update storage
    browser.storage.local.set({
      shortsHistory: shortsHistory,
      shortsUrls: shortsUrls,
      currentSessionShortsCount: currentSessionShortsCount
    });
  });
}

// Handle shorts skipped
function handleShortsSkipped(url) {
  checkAndHandleDayChange();
  const today = new Date().toISOString().split('T')[0];
  
  browser.storage.local.get(['shortsSkipped', 'skippedUrls'], (result) => {
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
    browser.storage.local.set({
      shortsSkipped: shortsSkipped,
      skippedUrls: skippedUrls
    });
  });
}

// Initialize badge on startup
browser.storage.local.get(['shortsHistory'], (result) => {
  const shortsHistory = result.shortsHistory || {};
  const today = new Date().toISOString().split('T')[0];
  const count = shortsHistory[today] || 0;
  updateBadge(count);
}); 