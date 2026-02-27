const output = document.getElementById('output');

async function sendMCPRequest(method, params = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'MCP_REQUEST',
      payload: { method, params }
    }, resolve);
  });
}

// Load and display the current Canvas URL
async function updateCanvasUrl() {
  try {
    const result = await chrome.storage.local.get(['canvasUrl']);
    const canvasUrl = result.canvasUrl || '';
    const canvasUrlInput = document.getElementById('canvasUrlInput');
    if (canvasUrlInput) {
      canvasUrlInput.value = canvasUrl;
      if (!canvasUrl) {
        canvasUrlInput.placeholder = 'https://canvas.instructure.com';
      }
    }
  } catch (error) {
    console.error('Error loading Canvas URL:', error);
  }
}

async function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_MCP_STATUS' }, (response) => {
    if (response) {
      document.getElementById('courseCount').textContent = response.courseCount || '0';

      const lastUpdate = response.dataLastUpdate
        ? new Date(response.dataLastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Never';
      document.getElementById('lastUpdate').textContent = lastUpdate;

      const nativeStatus = document.getElementById('nativeStatus');
      if (response.nativeHostConnected) {
        nativeStatus.textContent = 'Connected';
        nativeStatus.className = 'status-value connected';
      } else {
        nativeStatus.textContent = 'Disconnected';
        nativeStatus.className = 'status-value disconnected';
      }
    }
  });
}

function showOutput(text) {
  output.textContent = text;
  output.classList.add('show');
}

function hideOutput() {
  output.classList.remove('show');
}


document.getElementById('refreshData').addEventListener('click', async () => {
  showOutput('Syncing with Canvas...');
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'REFRESH_DATA' }, resolve);
    });

    if (response && response.success) {
      const counts = Object.entries(response.data)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => `${k}: ${v.length}`)
        .join('\n');

      showOutput(`✓ Sync complete\n\n${counts}`);
      updateStatus();

      // Hide output after 4 seconds
      setTimeout(hideOutput, 4000);
    } else {
      showOutput(`✗ Sync failed\n\n${response?.error || 'Unknown error'}`);
    }
  } catch (error) {
    showOutput(`✗ Error\n\n${error.message}`);
  }
});

// Listen for storage changes to update Canvas URL
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.canvasUrl) {
    updateCanvasUrl();
  }
});

// Available Tools panel
const toolsToggle = document.getElementById('toolsToggle');
const toolsContent = document.getElementById('toolsContent');
const toolsChevron = toolsToggle.querySelector('.chevron');

toolsToggle.addEventListener('click', async () => {
  const isOpen = toolsContent.classList.toggle('open');
  toolsChevron.classList.toggle('open', isOpen);
  if (isOpen) loadTools();
});

async function loadTools() {
  const toolList = document.getElementById('toolList');
  if (toolList.dataset.loaded) return;

  const response = await sendMCPRequest('tools/list');
  if (!response || !response.tools) {
    toolList.innerHTML = '<div style="color: #DC2626; font-size: 12px;">Failed to load tools</div>';
    return;
  }

  const tools = response.tools;
  document.getElementById('toolsCount').textContent = `(${tools.length})`;
  toolList.innerHTML = tools.map(t =>
    `<div class="tool-item">
      <code class="tool-name">${t.name}</code>
      <span class="tool-desc">${t.description}</span>
    </div>`
  ).join('');
  toolList.dataset.loaded = 'true';
}

// Setup instructions toggle
const claudeConfigToggle = document.getElementById('claudeConfigToggle');
const claudeConfigContent = document.getElementById('claudeConfigContent');
const setupChevron = claudeConfigToggle.querySelector('.chevron');

claudeConfigToggle.addEventListener('click', () => {
  const isOpen = claudeConfigContent.classList.toggle('open');
  setupChevron.classList.toggle('open', isOpen);
});

// Canvas URL inline editing
const canvasUrlInput = document.getElementById('canvasUrlInput');
const canvasUrlStatus = document.getElementById('canvasUrlStatus');

function showCanvasUrlStatus(message, type) {
  canvasUrlStatus.textContent = message;
  canvasUrlStatus.className = `status-message show ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      canvasUrlStatus.classList.remove('show');
    }, 3000);
  }
}

function isValidCanvasUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return false;
    }
    if (!parsed.hostname) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Auto-save Canvas URL on blur
canvasUrlInput.addEventListener('blur', async () => {
  const url = canvasUrlInput.value.trim();

  if (!url) {
    return; // Don't show error on blur if empty
  }

  if (!isValidCanvasUrl(url)) {
    showCanvasUrlStatus('Please enter a valid HTTPS URL', 'error');
    return;
  }

  try {
    await chrome.storage.local.set({ canvasUrl: url });
    showCanvasUrlStatus('✓ Saved', 'success');
  } catch (error) {
    showCanvasUrlStatus('✗ Save failed', 'error');
  }
});

// Auto-detect Canvas URL
document.getElementById('autoDetectUrl').addEventListener('click', async () => {
  showCanvasUrlStatus('Detecting...', 'success');

  try {
    const tabs = await chrome.tabs.query({});
    const canvasPatterns = [
      /^https?:\/\/[^\/]*instructure\.com/,
      /^https?:\/\/[^\/]*canvaslms\.com/,
      /^https?:\/\/canvas\.[^\/]+/,
      /^https?:\/\/[^\/]*\.edu\/.*canvas/i,
    ];

    const detectedUrls = [];

    for (const tab of tabs) {
      if (tab.url && canvasPatterns.some(pattern => pattern.test(tab.url))) {
        try {
          const url = new URL(tab.url);
          const baseUrl = `${url.protocol}//${url.host}`;
          if (!detectedUrls.includes(baseUrl)) {
            detectedUrls.push(baseUrl);
          }
        } catch (e) {
          console.error('Error parsing URL:', e);
        }
      }
    }

    if (detectedUrls.length === 0) {
      showCanvasUrlStatus('✗ No Canvas URLs found in open tabs', 'error');
      return;
    }

    canvasUrlInput.value = detectedUrls[0];
    await chrome.storage.local.set({ canvasUrl: detectedUrls[0] });
    showCanvasUrlStatus(`✓ Detected: ${detectedUrls[0]}`, 'success');
  } catch (error) {
    showCanvasUrlStatus('✗ Detection failed', 'error');
  }
});

// Initial load
updateCanvasUrl();
updateStatus();
setInterval(updateStatus, 10000);
