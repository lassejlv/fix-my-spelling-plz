// Background script for context menu handling

// Create context menu items when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fix-my-spelling",
    title: "Fix My Spelling",
    contexts: ["editable"],
  });

  chrome.contextMenus.create({
    id: "improve-writing",
    title: "Improve This Writing",
    contexts: ["editable"],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "fix-my-spelling" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "fixSpelling" });
  }

  if (info.menuItemId === "improve-writing" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "improveWriting" });
  }
});

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "fix-spelling" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "fixSpelling" });
  }

  if (command === "improve-writing" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "improveWriting" });
  }
});
