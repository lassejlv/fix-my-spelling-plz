// Options page script for Fix My Spelling extension

document.addEventListener("DOMContentLoaded", async () => {
  const apiEndpointInput = document.getElementById(
    "apiEndpoint",
  ) as HTMLInputElement;
  const saveButton = document.getElementById("saveBtn") as HTMLButtonElement;
  const resetButton = document.getElementById("resetBtn") as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLDivElement;

  // Load saved endpoint
  const result = await chrome.storage.sync.get(["apiEndpoint"]);
  if (result.apiEndpoint) {
    apiEndpointInput.value = result.apiEndpoint;
  }

  // Save endpoint
  saveButton.addEventListener("click", async () => {
    const endpoint = apiEndpointInput.value.trim();

    if (!endpoint) {
      showStatus("API endpoint is required", "error");
      return;
    }

    // Basic URL validation
    try {
      new URL(endpoint);
    } catch {
      showStatus("Please enter a valid URL", "error");
      return;
    }

    try {
      await chrome.storage.sync.set({ apiEndpoint: endpoint });
      showStatus("Settings saved successfully!", "success");
    } catch (error) {
      showStatus("Failed to save settings", "error");
    }
  });

  // Reset/clear the endpoint
  resetButton.addEventListener("click", async () => {
    apiEndpointInput.value = "";
    try {
      await chrome.storage.sync.remove(["apiEndpoint"]);
      showStatus("API endpoint cleared", "success");
    } catch (error) {
      showStatus("Failed to clear settings", "error");
    }
  });

  function showStatus(message: string, type: "success" | "error") {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;

    setTimeout(() => {
      statusDiv.className = "status";
    }, 3000);
  }
});
