// Background script for context menu handling

// Create context menu item when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fix-my-spelling",
    title: "Fix My Spelling",
    contexts: ["editable"],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "fix-my-spelling" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "fixSpelling" });
  }
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "fix-spelling" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "fixSpelling" });
  }
});
