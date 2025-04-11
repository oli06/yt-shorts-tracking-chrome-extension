// Track the last viewed Shorts URL
let lastShortsUrl = '';

// Function to check if we're on a Shorts page and send message
function checkAndSendMessage() {
  console.log('Checking URL:', window.location.pathname);
  if (window.location.pathname.startsWith('/shorts/')) {
    const currentUrl = window.location.pathname;
    if (currentUrl !== lastShortsUrl) {
      console.log('✅ New Shorts video detected:', currentUrl);
      lastShortsUrl = currentUrl;
      chrome.runtime.sendMessage({ 
        type: 'SHORTS_VIEWED',
        url: currentUrl
      });
    } else {
      console.log('🔄 Same Shorts video, skipping');
    }
  } else {
    console.log('❌ Not a Shorts video');
    lastShortsUrl = ''; // Reset when leaving Shorts
  }
}

// Initial check
console.log('📱 Content script loaded');
checkAndSendMessage();

// Set up a MutationObserver to detect URL changes
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