
/**
 * Content script for Gmail integration.
 * This script injects a button into the Gmail compose window.
 */

const INJECTED_BUTTON_ID = 'ai-email-assistant-btn';
const SIDEBAR_ID = 'ai-email-assistant-sidebar';

function injectButton() {
  // Gmail's compose window toolbar
  const toolbars = document.querySelectorAll('.btC');
  
  toolbars.forEach(toolbar => {
    if (toolbar.querySelector(`#${INJECTED_BUTTON_ID}`)) return;

    const btnContainer = document.createElement('div');
    btnContainer.id = INJECTED_BUTTON_ID;
    btnContainer.className = 'wG J-Z-I';
    btnContainer.style.display = 'inline-flex';
    btnContainer.style.alignItems = 'center';
    btnContainer.style.marginLeft = '8px';
    btnContainer.style.cursor = 'pointer';
    btnContainer.title = 'AI Email Assistant';

    btnContainer.innerHTML = `
      <div role="button" class="T-I J-J5-Ji aoO v7 T-I-atl L3" style="background-color: #4285f4; color: white; border-radius: 4px; padding: 0 12px; height: 36px; display: flex; alignItems: center;">
        <span style="font-weight: bold;">AI Write</span>
      </div>
    `;

    btnContainer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar(toolbar);
    });

    // Find the "Send" button container and insert after it
    const sendBtn = toolbar.querySelector('.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');
    if (sendBtn && sendBtn.parentElement) {
      sendBtn.parentElement.appendChild(btnContainer);
    }
  });
}

function toggleSidebar(toolbar: Element) {
  let sidebar = document.getElementById(SIDEBAR_ID);
  
  if (sidebar) {
    sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
    return;
  }

  // Create sidebar
  sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  sidebar.style.position = 'fixed';
  sidebar.style.right = '0';
  sidebar.style.top = '0';
  sidebar.style.width = '400px';
  sidebar.style.height = '100%';
  sidebar.style.backgroundColor = '#111827';
  sidebar.style.boxShadow = '-2px 0 10px rgba(0,0,0,0.5)';
  sidebar.style.zIndex = '9999';
  sidebar.style.borderLeft = '1px solid #374151';
  sidebar.style.display = 'block';

  // Header
  const header = document.createElement('div');
  header.style.padding = '16px';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.borderBottom = '1px solid #374151';
  header.innerHTML = `
    <h2 style="color: #60a5fa; margin: 0; font-size: 18px;">AI Email Assistant</h2>
    <button id="close-ai-sidebar" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 20px;">&times;</button>
  `;
  sidebar.appendChild(header);

  // Iframe to load the app
  const iframe = document.createElement('iframe');
  // Load the local extension index.html
  const appUrl = chrome.runtime.getURL('index.html'); 
  iframe.src = `${appUrl}?extension=true`;
  iframe.style.width = '100%';
  iframe.style.height = 'calc(100% - 60px)';
  iframe.style.border = 'none';
  sidebar.appendChild(iframe);

  document.body.appendChild(sidebar);

  document.getElementById('close-ai-sidebar')?.addEventListener('click', () => {
    if (sidebar) sidebar.style.display = 'none';
  });

  // Listen for messages from the iframe — restrict to this extension's origin only
  const extensionOrigin = new URL(chrome.runtime.getURL('')).origin;
  window.addEventListener('message', (event) => {
    if (event.origin !== extensionOrigin) return;
    if (event.data.type === 'INSERT_EMAIL') {
      insertTextIntoGmail(event.data.text, toolbar);
    }
  });
}

function insertTextIntoGmail(text: string, toolbar: Element) {
  // Find the compose body
  // Gmail uses contenteditable divs for compose
  const composeWindow = toolbar.closest('.M9');
  if (!composeWindow) return;

  const editable = composeWindow.querySelector('.Am.Al.editable');
  if (editable) {
    // Use safe DOM insertion to avoid HTML injection
    editable.textContent = '';
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      editable.appendChild(document.createTextNode(line));
      if (i < lines.length - 1) {
        editable.appendChild(document.createElement('br'));
      }
    });
    // Trigger input event to make sure Gmail registers the change
    editable.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Observe for changes to inject button when compose window opens
const observer = new MutationObserver(() => {
  injectButton();
});

observer.observe(document.body, { childList: true, subtree: true });
injectButton();
