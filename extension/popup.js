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

document.getElementById('testListCourses').addEventListener('click', async () => {
  showOutput('Testing connection...');
  const response = await sendMCPRequest('tools/call', {
    name: 'list_courses',
    arguments: {}
  });

  try {
    // Handle both response.result.content and response.content structures
    const content = response?.result?.content || response?.content;

    if (content && content[0] && content[0].text) {
      const data = JSON.parse(content[0].text);
      showOutput(`✓ Connected\n\nCourses: ${data.count}\nLast update: ${data.lastUpdate || 'Unknown'}`);
    } else {
      showOutput(`✗ Connection failed\n\n${JSON.stringify(response, null, 2)}`);
    }
  } catch (error) {
    showOutput(`✗ Parse error\n\n${error.message}\n\nResponse: ${JSON.stringify(response, null, 2)}`);
  }
});

document.getElementById('refreshData').addEventListener('click', async () => {
  showOutput('Syncing with Canvas...');
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'REFRESH_DATA' }, resolve);
    });

    if (response && response.success) {
      const coursesCount = response.data.courses?.length || 0;
      const allAssignmentsCount = response.data.allAssignments?.length || 0;
      const calendarEventsCount = response.data.calendarEvents?.length || 0;
      const upcomingEventsCount = response.data.upcomingEvents?.length || 0;

      showOutput(
        `✓ Sync complete\n\n` +
        `Courses: ${coursesCount}\n` +
        `All Assignments: ${allAssignmentsCount}\n` +
        `Calendar Events: ${calendarEventsCount}\n` +
        `Upcoming Events: ${upcomingEventsCount}`
      );
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
  canvasUrlStatus.className = `canvas-url-status show ${type}`;

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

// Save Canvas URL
document.getElementById('saveCanvasUrl').addEventListener('click', async () => {
  const url = canvasUrlInput.value.trim();

  if (!url) {
    showCanvasUrlStatus('Please enter a Canvas URL', 'error');
    return;
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
setInterval(updateStatus, 2000);
