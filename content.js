// Track the last viewed Shorts URL
let lastShortsUrl = '';
let shortsTimer = null;
let currentShortsUrl = null;
let shortsStartTime = null;
let currentVideo = null;
let sessionStartTime = null;
let thresholdTimer = null;

// Function to format time in MM:SS
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to end current session
function endSession() {
  if (sessionStartTime) {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    chrome.runtime.sendMessage({
      type: 'END_SESSION',
      duration: sessionDuration,
      timestamp: timestamp
    });
    sessionStartTime = null;
  }
}

// Function to find and observe the video element
function findAndObserveVideo() {
  const video = document.querySelector('video');
  if (video) {
    if (video !== currentVideo) {
      currentVideo = video;
    }
  } else {
    // Try again in a short moment
    setTimeout(findAndObserveVideo, 50);
  }
}

// Function to check if we're on a Shorts page and send message
function checkAndSendMessage() {
  if (window.location.pathname.startsWith('/shorts/')) {
    const newUrl = window.location.pathname;
    
    // If this is a new shorts session, notify background
    if (!currentShortsUrl) {
      sessionStartTime = Date.now();
      chrome.runtime.sendMessage({ type: 'START_SHORTS_SESSION' });
    }
    
    // If we were on a different Shorts video before, check if it was skipped
    if (currentShortsUrl && currentShortsUrl !== newUrl && shortsStartTime) {
      const timeSpent = Date.now() - shortsStartTime;
      if (timeSpent < 1000) {
        chrome.runtime.sendMessage({ 
          type: 'SHORTS_SKIPPED',
          url: currentShortsUrl
        });
      }
    }
    
    // Update tracking for new Shorts video
    if (newUrl !== lastShortsUrl) {
      currentShortsUrl = newUrl;
      shortsStartTime = Date.now();
      
      // Clear any existing timer
      if (shortsTimer) {
        clearTimeout(shortsTimer);
      }
            
      // Find and observe the video element immediately for the new Short
      findAndObserveVideo();
      
      // Start a new timer for view count
      shortsTimer = setTimeout(() => {
        lastShortsUrl = newUrl;
        chrome.runtime.sendMessage({ 
          type: 'SHORTS_VIEWED',
          url: newUrl
        });
      }, 1000); // 1 second delay
    } else {
      // Re-check video element in case it was replaced
      findAndObserveVideo();
    }
  } else {
    // Check if we're leaving a Shorts video that was skipped
    if (currentShortsUrl && shortsStartTime) {
      const timeSpent = Date.now() - shortsStartTime;
      if (timeSpent < 1000) {
        chrome.runtime.sendMessage({ 
          type: 'SHORTS_SKIPPED',
          url: currentShortsUrl
        });
      }
    }
    
    // Clean up when leaving Shorts
    if (shortsTimer) {
      clearTimeout(shortsTimer);
      shortsTimer = null;
    }
    
    lastShortsUrl = '';
    currentShortsUrl = null;
    shortsStartTime = null;
    
    // End current session if it exists
    endSession();
  }
}

// Initial check
checkAndSendMessage();

// Set up a MutationObserver to detect URL changes and video element changes
const observer = new MutationObserver((mutations) => {
  // Check if the URL has changed
  if (mutations.some(mutation => 
    mutation.type === 'attributes' && 
    mutation.attributeName === 'href' &&
    mutation.target.href?.includes('/shorts/')
  )) {
    checkAndSendMessage();
  }
  
  // Check if we need to find and observe a new video element
  if (window.location.pathname.startsWith('/shorts/') && 
      mutations.some(mutation => mutation.addedNodes.length > 0)) {
    findAndObserveVideo();
  }
});

// Start observing the document for changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['href']
});

// Also listen for popstate events (back/forward navigation)
window.addEventListener('popstate', () => {
  checkAndSendMessage();
});

// Listen for YouTube's internal navigation events
document.addEventListener('yt-navigate-finish', () => {
  checkAndSendMessage();
});

// Listen for visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (currentVideo && currentVideo.paused) {
      // If video is paused, end session immediately
      endSession();
    } else {
      // If video is playing, continue tracking
    }
  } else if (window.location.pathname.startsWith('/shorts/')) {
    if (!sessionStartTime) {
      sessionStartTime = Date.now();
    }
  }
});

// Listen for page unload (tab closed)
window.addEventListener('beforeunload', () => {
  endSession();
}); 