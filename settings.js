// Load settings when page opens
document.addEventListener('DOMContentLoaded', function() {
  // Load all settings
  chrome.storage.local.get(['enableRedirect', 'redirectThreshold'], function(result) {
    // Set redirect checkbox
    document.getElementById('enableRedirect').checked = result.enableRedirect || false;
    
    // Set redirect threshold
    document.getElementById('redirectThreshold').value = result.redirectThreshold || 5;
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

  // Handle back button click
  document.getElementById('backButton').addEventListener('click', function() {
    window.close();
  });
}); 