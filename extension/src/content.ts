let apiUrl: string | null = null;

// Load API URL from storage
async function getApiUrl(): Promise<string | null> {
  if (apiUrl) return apiUrl;

  try {
    const result = await chrome.storage.sync.get(["apiEndpoint"]);
    apiUrl = result.apiEndpoint || null;
    return apiUrl;
  } catch {
    return null;
  }
}

// Listen for storage changes to update API URL
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiEndpoint) {
    apiUrl = changes.apiEndpoint.newValue;
  }
});

type TextInputElement = HTMLInputElement | HTMLTextAreaElement;
type EditableElement = TextInputElement | HTMLElement;

let activeElement: EditableElement | null = null;
let popupElement: HTMLDivElement | null = null;
let originalText = "";
let correctedText = "";
let isLoading = false;
let currentMode: "spelling" | "improve" = "spelling";

function injectStyles(): void {
  if (document.getElementById("fix-spelling-styles")) return;

  const style = document.createElement("style");
  style.id = "fix-spelling-styles";
  style.textContent = `
    @keyframes fix-spelling-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes fix-spelling-fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fix-spelling-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    #fix-spelling-popup {
      animation: fix-spelling-fadeIn 0.25s ease-out;
    }
    #fix-spelling-popup.loading .fix-spelling-spinner {
      animation: fix-spelling-spin 1s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

function createPopup(): HTMLDivElement {
  injectStyles();

  const popup = document.createElement("div");
  popup.id = "fix-spelling-popup";
  popup.style.cssText = `
    position: absolute;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    overflow: hidden;
    width: 420px;
    max-width: calc(100vw - 32px);
  `;

  document.body.appendChild(popup);
  return popup;
}

function positionPopup(element: EditableElement): void {
  if (!popupElement) return;
  const rect = element.getBoundingClientRect();
  const popupWidth = 420;
  const popupHeight = popupElement.offsetHeight;

  let left = window.scrollX + rect.left;
  if (left + popupWidth > window.innerWidth - 16) {
    left = window.innerWidth - popupWidth - 16;
  }
  if (left < 16) {
    left = 16;
  }

  let top = window.scrollY + rect.top - popupHeight - 8;
  // If popup would be off-screen at top, show it below the element instead
  if (top < window.scrollY + 8) {
    top = window.scrollY + rect.bottom + 8;
  }

  popupElement.style.top = `${top}px`;
  popupElement.style.left = `${left}px`;
}

function showLoadingPopup(mode: "spelling" | "improve" = "spelling"): void {
  if (!popupElement) {
    popupElement = createPopup();
  }

  const message =
    mode === "spelling" ? "Checking spelling..." : "Improving writing...";

  popupElement.classList.add("loading");
  popupElement.innerHTML = `
    <div style="padding: 16px 20px; display: flex; align-items: center; gap: 12px;">
      <svg class="fix-spelling-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <div style="color: #9ca3af; font-size: 13px;">${message}</div>
    </div>
  `;

  popupElement.style.display = "block";

  requestAnimationFrame(() => {
    if (activeElement) {
      positionPopup(activeElement);
    }
  });
}

function showSuggestionPopup(mode: "spelling" | "improve" = "spelling"): void {
  if (!popupElement) {
    popupElement = createPopup();
  }

  const title = mode === "spelling" ? "Spelling Fixed" : "Improved Writing";
  const icon =
    mode === "spelling"
      ? `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`
      : `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><path d="M15 6l3 3"/>`;

  popupElement.classList.remove("loading");
  popupElement.innerHTML = `
    <div style="padding: 16px 20px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2">
          ${icon}
        </svg>
        <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">${title}</div>
      </div>
      <div style="color: #f3f4f6; font-size: 15px; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap;">${escapeHtml(correctedText)}</div>
    </div>
    <div style="display: flex; border-top: 1px solid #374151;">
      <button id="fix-accept" style="
        flex: 1;
        padding: 14px 20px;
        border: none;
        background: transparent;
        color: #4ade80;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: background 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Accept
      </button>
      <div style="width: 1px; background: #374151;"></div>
      <button id="fix-copy" style="
        flex: 1;
        padding: 14px 20px;
        border: none;
        background: transparent;
        color: #60a5fa;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: background 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy
      </button>
      <div style="width: 1px; background: #374151;"></div>
      <button id="fix-deny" style="
        flex: 1;
        padding: 14px 20px;
        border: none;
        background: transparent;
        color: #f87171;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: background 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Dismiss
      </button>
    </div>
  `;

  const acceptBtn = popupElement.querySelector(
    "#fix-accept",
  ) as HTMLButtonElement;
  const copyBtn = popupElement.querySelector("#fix-copy") as HTMLButtonElement;
  const denyBtn = popupElement.querySelector("#fix-deny") as HTMLButtonElement;

  acceptBtn.addEventListener(
    "mouseenter",
    () => (acceptBtn.style.background = "rgba(74, 222, 128, 0.1)"),
  );
  acceptBtn.addEventListener(
    "mouseleave",
    () => (acceptBtn.style.background = "transparent"),
  );
  copyBtn.addEventListener(
    "mouseenter",
    () => (copyBtn.style.background = "rgba(96, 165, 250, 0.1)"),
  );
  copyBtn.addEventListener(
    "mouseleave",
    () => (copyBtn.style.background = "transparent"),
  );
  denyBtn.addEventListener(
    "mouseenter",
    () => (denyBtn.style.background = "rgba(248, 113, 113, 0.1)"),
  );
  denyBtn.addEventListener(
    "mouseleave",
    () => (denyBtn.style.background = "transparent"),
  );

  acceptBtn.addEventListener("click", handleAccept);
  copyBtn.addEventListener("click", handleCopy);
  denyBtn.addEventListener("click", handleDeny);

  popupElement.style.display = "block";

  requestAnimationFrame(() => {
    if (activeElement) {
      positionPopup(activeElement);
    }
  });
}

function hidePopup(): void {
  if (popupElement) {
    popupElement.style.display = "none";
  }
}

function showError(message: string): void {
  if (!popupElement) {
    popupElement = createPopup();
  }

  popupElement.classList.remove("loading");
  popupElement.innerHTML = `
    <div style="padding: 16px 20px; color: #f87171; display: flex; align-items: center; gap: 10px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      ${escapeHtml(message)}
    </div>
  `;

  popupElement.style.display = "block";

  requestAnimationFrame(() => {
    if (activeElement) {
      positionPopup(activeElement);
    }
  });

  setTimeout(hidePopup, 2500);
}

function showNoChanges(): void {
  if (!popupElement) {
    popupElement = createPopup();
  }

  popupElement.classList.remove("loading");
  popupElement.innerHTML = `
    <div style="padding: 16px 20px; color: #4ade80; display: flex; align-items: center; gap: 10px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      No spelling issues found
    </div>
  `;

  popupElement.style.display = "block";

  requestAnimationFrame(() => {
    if (activeElement) {
      positionPopup(activeElement);
    }
  });

  setTimeout(hidePopup, 2000);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Check if element is a standard text input or textarea
function isTextInputElement(
  element: Element | null,
): element is TextInputElement {
  if (!element) return false;
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName === "INPUT") {
    const type = (element as HTMLInputElement).type;
    return (
      type === "text" ||
      type === "search" ||
      type === "email" ||
      type === "url" ||
      !type
    );
  }
  return false;
}

// Check if element is a contenteditable element
function isContentEditable(element: Element | null): element is HTMLElement {
  if (!element) return false;

  // Check if the element itself is contenteditable
  if (element instanceof HTMLElement) {
    if (element.isContentEditable) return true;
    if (element.getAttribute("contenteditable") === "true") return true;
    if (element.getAttribute("role") === "textbox") return true;
  }

  return false;
}

// Check if element is any editable element (input, textarea, or contenteditable)
function isEditableElement(
  element: Element | null,
): element is EditableElement {
  return isTextInputElement(element) || isContentEditable(element);
}

// Find the closest editable element (for nested contenteditable structures like Twitter)
function findEditableElement(element: Element | null): EditableElement | null {
  if (!element) return null;

  // First check if the element itself is editable
  if (isEditableElement(element)) return element;

  // Walk up the DOM tree to find a contenteditable parent
  let current: Element | null = element;
  while (current) {
    if (isContentEditable(current)) return current;
    if (isTextInputElement(current)) return current;
    current = current.parentElement;
  }

  return null;
}

// Get text content from an editable element
function getTextFromElement(element: EditableElement): string {
  if (isTextInputElement(element)) {
    return element.value;
  }
  // For contenteditable, get the text content
  return element.innerText || element.textContent || "";
}

// Get selected text from an editable element
function getSelectedText(element: EditableElement): {
  text: string;
  hasSelection: boolean;
} {
  if (isTextInputElement(element)) {
    const selectionStart = element.selectionStart ?? 0;
    const selectionEnd = element.selectionEnd ?? 0;
    const hasSelection = selectionStart !== selectionEnd;

    if (hasSelection) {
      return {
        text: element.value.substring(selectionStart, selectionEnd),
        hasSelection: true,
      };
    }
    return { text: element.value, hasSelection: false };
  }

  // For contenteditable, use window selection
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    return { text: selection.toString(), hasSelection: true };
  }

  return { text: getTextFromElement(element), hasSelection: false };
}

// Set text in an editable element
function setTextInElement(
  element: EditableElement,
  text: string,
  replaceSelection: boolean,
): void {
  if (isTextInputElement(element)) {
    if (replaceSelection) {
      const selectionStart = element.selectionStart ?? 0;
      const selectionEnd = element.selectionEnd ?? 0;
      const before = element.value.substring(0, selectionStart);
      const after = element.value.substring(selectionEnd);
      element.value = before + text + after;
    } else {
      element.value = text;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  // For contenteditable (like Twitter)
  // Focus the element first
  element.focus();

  // Select all content if not replacing selection
  if (!replaceSelection) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // Use execCommand for better compatibility with React/frameworks
  // This simulates actual user input which triggers React's onChange
  const success = document.execCommand("insertText", false, text);

  if (!success) {
    // Fallback: try using InputEvent (modern approach)
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();

      // Insert text node
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);

      // Move cursor to end
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Dispatch InputEvent which React listens to
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text,
    });
    element.dispatchEvent(inputEvent);
  }

  // Also dispatch these events for good measure
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));

  // For Twitter specifically, also try triggering a blur/focus cycle
  // to ensure their state updates
  setTimeout(() => {
    element.blur();
    element.focus();
  }, 0);
}

// Store selection state for contenteditable restoration
let savedSelection: { hasSelection: boolean } = { hasSelection: false };

async function checkSpelling(): Promise<void> {
  if (isLoading) return;
  if (!activeElement) return;

  currentMode = "spelling";
  const { text: textToCheck, hasSelection } = getSelectedText(activeElement);
  savedSelection = { hasSelection };

  if (!textToCheck.trim()) return;

  originalText = textToCheck;
  isLoading = true;

  showLoadingPopup("spelling");

  try {
    const endpoint = await getApiUrl();
    if (!endpoint) {
      isLoading = false;
      showError(
        "API endpoint not configured. Please set it in extension options.",
      );
      return;
    }

    // Replace the endpoint path for spelling
    const spellingEndpoint = endpoint.replace(/\/[^\/]*$/, "/fix-my-spelling");

    const response = await fetch(spellingEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: originalText }),
    });

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();
    correctedText = data.corrected;

    isLoading = false;

    if (correctedText === originalText) {
      showNoChanges();
      return;
    }

    showSuggestionPopup("spelling");
  } catch (error) {
    isLoading = false;
    showError("Could not connect to API");
  }
}

async function improveWriting(): Promise<void> {
  if (isLoading) return;
  if (!activeElement) return;

  currentMode = "improve";
  const { text: textToCheck, hasSelection } = getSelectedText(activeElement);
  savedSelection = { hasSelection };

  if (!textToCheck.trim()) return;

  originalText = textToCheck;
  isLoading = true;

  showLoadingPopup("improve");

  try {
    const endpoint = await getApiUrl();
    if (!endpoint) {
      isLoading = false;
      showError(
        "API endpoint not configured. Please set it in extension options.",
      );
      return;
    }

    // Replace the endpoint path for improve writing
    const improveEndpoint = endpoint.replace(
      /\/[^\/]*$/,
      "/improve-this-writing",
    );

    const response = await fetch(improveEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: originalText }),
    });

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();
    correctedText = data.improved;

    isLoading = false;

    if (correctedText === originalText) {
      showNoChanges();
      return;
    }

    showSuggestionPopup("improve");
  } catch (error) {
    isLoading = false;
    showError("Could not connect to API");
  }
}

function handleAccept(): void {
  if (activeElement) {
    setTextInElement(activeElement, correctedText, savedSelection.hasSelection);
  }
  hidePopup();
}

function handleDeny(): void {
  hidePopup();
}

async function handleCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(correctedText);

    // Show brief "Copied!" feedback
    const copyBtn = popupElement?.querySelector(
      "#fix-copy",
    ) as HTMLButtonElement;
    if (copyBtn) {
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
      `;
      copyBtn.style.color = "#4ade80";

      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.style.color = "#60a5fa";
      }, 1500);
    }
  } catch (err) {
    console.error("Failed to copy text:", err);
  }
}

// Listen for messages from background script (context menu clicks)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "fixSpelling" || message.action === "improveWriting") {
    // Get the currently focused element
    const focusedElement = document.activeElement;
    const editableElement = findEditableElement(focusedElement);

    if (editableElement) {
      activeElement = editableElement;
      if (message.action === "fixSpelling") {
        checkSpelling();
      } else {
        improveWriting();
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No editable element focused" });
    }
  }
  return true;
});

// Track the last right-clicked element
document.addEventListener("contextmenu", (e) => {
  const target = e.target as Element;
  const editableElement = findEditableElement(target);
  if (editableElement) {
    activeElement = editableElement;
  }
});

// Hide popup when clicking outside
document.addEventListener("click", (e) => {
  const target = e.target as Element;
  if (
    popupElement &&
    !popupElement.contains(target) &&
    !isEditableElement(target)
  ) {
    hidePopup();
  }
});

// Update popup position on scroll
window.addEventListener(
  "scroll",
  () => {
    if (activeElement && popupElement?.style.display !== "none") {
      positionPopup(activeElement);
    }
  },
  true,
);

// Update popup position on resize
window.addEventListener("resize", () => {
  if (activeElement && popupElement?.style.display !== "none") {
    positionPopup(activeElement);
  }
});

// Hide popup on Escape key and handle keyboard shortcut
document.addEventListener("keydown", (e) => {
  // Escape to close popup
  if (e.key === "Escape" && popupElement?.style.display !== "none") {
    hidePopup();
    return;
  }

  // Cmd+Shift+F (Mac) or Ctrl+Shift+F (Windows/Linux) to trigger spell check
  if (e.key === "f" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();

    const focusedElement = document.activeElement;
    const editableElement = findEditableElement(focusedElement);

    if (editableElement) {
      activeElement = editableElement;
      checkSpelling();
    }
  }

  // Cmd+Shift+I (Mac) or Ctrl+Shift+I (Windows/Linux) to trigger improve writing
  if (e.key === "i" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();

    const focusedElement = document.activeElement;
    const editableElement = findEditableElement(focusedElement);

    if (editableElement) {
      activeElement = editableElement;
      improveWriting();
    }
  }
});
