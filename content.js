// Track the last viewed Shorts URL
let lastShortsUrl = '';
let shortsTimer = null;
let currentShortsUrl = null;
let shortsStartTime = null;
let watchTimeInterval = null;
let currentVideo = null;

// Function to send watch time update
function updateWatchTime() {
  if (currentShortsUrl && currentVideo && !currentVideo.paused) {
    console.log('⏱️ Updating watch time');
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_WATCH_TIME',
      seconds: 1
    });
  }
}

// Function to start watch time tracking
function startWatchTimeTracking() {
  stopWatchTimeTracking(); // Ensure no duplicate intervals
  console.log('▶️ Starting watch time tracking');
  watchTimeInterval = setInterval(updateWatchTime, 1000);
}

// Function to stop watch time tracking
function stopWatchTimeTracking() {
  console.log('⏸️ Stopping watch time tracking');
  if (watchTimeInterval) {
    clearInterval(watchTimeInterval);
    watchTimeInterval = null;
  }
}

// Bound event handlers to ensure proper removal
function onVideoPlay() {
  console.log('▶️ Video play event');
  startWatchTimeTracking();
}

function onVideoPause() {
  console.log('⏸️ Video pause event');
  stopWatchTimeTracking();
}

// Function to observe video element
function observeVideo(video) {
  if (!video) return;
  
  console.log('🎥 Observing new video element, paused state:', video.paused);
  
  // Clean up previous video
  if (currentVideo) {
    currentVideo.removeEventListener('play', onVideoPlay);
    currentVideo.removeEventListener('pause', onVideoPause);
    stopWatchTimeTracking();
  }
  
  currentVideo = video;
  
  // Watch for play/pause events
  video.addEventListener('play', onVideoPlay);
  video.addEventListener('pause', onVideoPause);
  video.addEventListener('timeupdate', () => {
    if (!video.paused && !watchTimeInterval) {
      console.log('🎬 Video playing detected via timeupdate');
      onVideoPlay();
    }
  });
  
  // Trigger play handler immediately if video is already playing
  if (!video.paused && video.currentTime > 0) {
    console.log('🎬 Video already playing, starting timer');
    onVideoPlay();
  }
}

// Function to find and observe the video element
function findAndObserveVideo() {
  const video = document.querySelector('video');
  if (video) {
    console.log('📺 Found video element, readyState:', video.readyState);
    if (video !== currentVideo) {
      observeVideo(video);
    }
  } else {
    console.log('❌ No video element found yet');
    // Try again in a short moment
    setTimeout(findAndObserveVideo, 50);
  }
}

// Function to check if we're on a Shorts page and send message
function checkAndSendMessage() {
  console.log('Checking URL:', window.location.pathname);
  if (window.location.pathname.startsWith('/shorts/')) {
    const newUrl = window.location.pathname;
    
    // If this is a new shorts session, notify background
    if (!currentShortsUrl) {
      chrome.runtime.sendMessage({ type: 'START_SHORTS_SESSION' });
    }
    
    // If we were on a different Shorts video before, check if it was skipped
    if (currentShortsUrl && currentShortsUrl !== newUrl && shortsStartTime) {
      const timeSpent = Date.now() - shortsStartTime;
      if (timeSpent < 1000) {
        console.log('⏭️ Previous Shorts video skipped:', currentShortsUrl);
        chrome.runtime.sendMessage({ 
          type: 'SHORTS_SKIPPED',
          url: currentShortsUrl
        });
      }
    }
    
    // Update tracking for new Shorts video
    if (newUrl !== lastShortsUrl) {
      console.log('✅ New Shorts video detected:', newUrl);
      currentShortsUrl = newUrl;
      shortsStartTime = Date.now();
      
      // Clear any existing timer
      if (shortsTimer) {
        clearTimeout(shortsTimer);
      }
      
      // Stop existing watch time tracking
      stopWatchTimeTracking();
      
      // Find and observe the video element immediately for the new Short
      findAndObserveVideo();
      
      // Start a new timer for view count
      shortsTimer = setTimeout(() => {
        console.log('⏱️ Shorts viewed for more than 1 second:', newUrl);
        lastShortsUrl = newUrl;
        chrome.runtime.sendMessage({ 
          type: 'SHORTS_VIEWED',
          url: newUrl
        });
        
        // Check video state again after marking as viewed
        if (currentVideo && !currentVideo.paused) {
          console.log('🎬 Video still playing after view count');
          onVideoPlay();
        }
      }, 1000); // 1 second delay
    } else {
      console.log('🔄 Same Shorts video, checking state');
      // Re-check video element in case it was replaced
      findAndObserveVideo();
    }
  } else {
    console.log('❌ Not a Shorts video');
    // Check if we're leaving a Shorts video that was skipped
    if (currentShortsUrl && shortsStartTime) {
      const timeSpent = Date.now() - shortsStartTime;
      if (timeSpent < 1000) {
        console.log('⏭️ Previous Shorts video skipped:', currentShortsUrl);
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
    
    if (currentVideo) {
      currentVideo.removeEventListener('play', onVideoPlay);
      currentVideo.removeEventListener('pause', onVideoPause);
      currentVideo = null;
    }
    
    stopWatchTimeTracking();
    lastShortsUrl = '';
    currentShortsUrl = null;
    shortsStartTime = null;
    
    // Notify background that shorts session has ended
    chrome.runtime.sendMessage({ type: 'END_SHORTS_SESSION' });
  }
}

// Initial check
console.log('📱 Content script loaded');
checkAndSendMessage();

// Set up a MutationObserver to detect URL changes and video element changes
const observer = new MutationObserver((mutations) => {
  // Check if the URL has changed
  if (mutations.some(mutation => 
    mutation.type === 'attributes' && 
    mutation.attributeName === 'href' &&
    mutation.target.href?.includes('/shorts/')
  )) {
    console.log('🔄 URL change detected in DOM');
    checkAndSendMessage();
  }
  
  // Check if we need to find and observe a new video element
  if (window.location.pathname.startsWith('/shorts/') && 
      mutations.some(mutation => mutation.addedNodes.length > 0)) {
    findAndObserveVideo();
  }
});

// Start observing the document for changes
console.log('👀 Starting DOM observer');
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['href']
});

// Also listen for popstate events (back/forward navigation)
window.addEventListener('popstate', () => {
  console.log('⏪⏩ Browser navigation detected');
  checkAndSendMessage();
});

// Listen for YouTube's internal navigation events
document.addEventListener('yt-navigate-finish', () => {
  console.log('🎥 YouTube navigation finished');
  checkAndSendMessage();
}); 