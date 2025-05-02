// Load settings when page opens
document.addEventListener('DOMContentLoaded', function() {
  // Load all settings
  chrome.storage.local.get(['enableRedirect', 'redirectThreshold', 'customRedirectUrl'], function(result) {
    const enableRedirect = result.enableRedirect || false;
    
    // Set redirect checkbox
    document.getElementById('enableRedirect').checked = enableRedirect;
    
    // Set redirect threshold and its disabled state
    const redirectThresholdInput = document.getElementById('redirectThreshold');
    redirectThresholdInput.value = result.redirectThreshold || 5;
    redirectThresholdInput.disabled = !enableRedirect;
    
    // Set custom redirect URL and its disabled state
    const customRedirectUrlInput = document.getElementById('customRedirectUrl');
    customRedirectUrlInput.value = result.customRedirectUrl || 'https://www.reddit.com/r/GetDisciplined';
    customRedirectUrlInput.disabled = !enableRedirect;
  });

  // Save redirect setting when changed
  document.getElementById('enableRedirect').addEventListener('change', function(e) {
    chrome.storage.local.set({ enableRedirect: e.target.checked });
    // Enable/disable URL input and threshold input based on checkbox state
    document.getElementById('customRedirectUrl').disabled = !e.target.checked;
    document.getElementById('redirectThreshold').disabled = !e.target.checked;
  });

  // Save redirect threshold when changed
  document.getElementById('redirectThreshold').addEventListener('change', function(e) {
    const value = parseInt(e.target.value, 10);
    if (value >= 1 && value <= 100) {
      chrome.storage.local.set({ redirectThreshold: value });
    }
  });

  // Save custom redirect URL when changed
  document.getElementById('customRedirectUrl').addEventListener('change', function(e) {
    const url = e.target.value.trim();
    if (url) {
      chrome.storage.local.set({ customRedirectUrl: url });
    }
  });

  // Handle reset URL button click
  document.getElementById('resetUrlButton').addEventListener('click', function() {
    const defaultUrl = 'https://www.reddit.com/r/GetDisciplined';
    document.getElementById('customRedirectUrl').value = defaultUrl;
    chrome.storage.local.set({ customRedirectUrl: defaultUrl });
  });

  // Handle back button click
  document.getElementById('backButton').addEventListener('click', function() {
    window.close();
  });
}); 