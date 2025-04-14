// Load settings when page opens
document.addEventListener('DOMContentLoaded', function() {
  // Load all settings
  chrome.storage.local.get(['enableRedirect', 'redirectThreshold', 'enableTimeBasedRedirect'], function(result) {
    // Set redirect checkbox
    document.getElementById('enableRedirect').checked = result.enableRedirect || false;
    
    // Set redirect threshold
    document.getElementById('redirectThreshold').value = result.redirectThreshold || 5;
    
    // Set time-based redirect checkbox
    document.getElementById('enableTimeBasedRedirect').checked = result.enableTimeBasedRedirect || false;
  });

  // Save redirect setting when changed
  document.getElementById('enableRedirect').addEventListener('change', function(e) {
    chrome.storage.local.set({ enableRedirect: e.target.checked });
  });

  // Save redirect threshold when changed
  document.getElementById('redirectThreshold').addEventListener('change', function(e) {
    const value = parseInt(e.target.value, 10);
    if (value >= 1 && value <= 100) {
      chrome.storage.local.set({ redirectThreshold: value });
    }
  });

  // Save time-based redirect setting when changed
  document.getElementById('enableTimeBasedRedirect').addEventListener('change', function(e) {
    chrome.storage.local.set({ enableTimeBasedRedirect: e.target.checked });
  });

  // Handle back button click
  document.getElementById('backButton').addEventListener('click', function() {
    window.close();
  });
}); 