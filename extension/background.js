importScripts('tools.js'); // MCP_TOOLS array from shared canonical source

// MCP Server HTTP endpoint (extension uses HTTP to avoid cert issues)
const MCP_SERVER_URL = 'http://localhost:8765/canvas-data';

// Store Canvas data
let canvasData = {
  courses: [],
  assignments: {},
  allAssignments: [],
  calendarEvents: [],
  upcomingEvents: [],
  submissions: {},
  modules: {},
  analytics: {},
  userProfile: null,
  grades: {},
  assignmentGroups: {},
  announcements: {},
  missingSubmissions: [],
  todoItems: [],
  plannerItems: [],
  discussions: {},
  pages: {},
  files: {},
  lastUpdate: null
};

// Storage key for cached Canvas data
const CANVAS_DATA_CACHE_KEY = 'cachedCanvasData';

// Track MCP server connection status
let mcpServerConnected = false;

// Save Canvas data to persistent storage
async function saveCanvasDataToStorage() {
  try {
    await chrome.storage.local.set({
      [CANVAS_DATA_CACHE_KEY]: {
        ...canvasData,
        cacheTimestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to save Canvas data to storage:', error);
  }
}

// Load Canvas data from persistent storage
async function loadCanvasDataFromStorage() {
  try {
    const result = await chrome.storage.local.get([CANVAS_DATA_CACHE_KEY]);
    if (result[CANVAS_DATA_CACHE_KEY]) {
      const cached = result[CANVAS_DATA_CACHE_KEY];
      // Restore all data from cache
      canvasData = {
        courses: cached.courses || [],
        assignments: cached.assignments || {},
        allAssignments: cached.allAssignments || [],
        calendarEvents: cached.calendarEvents || [],
        upcomingEvents: cached.upcomingEvents || [],
        submissions: cached.submissions || {},
        modules: cached.modules || {},
        analytics: cached.analytics || {},
        userProfile: cached.userProfile || null,
        grades: cached.grades || {},
        assignmentGroups: cached.assignmentGroups || {},
        announcements: cached.announcements || {},
        missingSubmissions: cached.missingSubmissions || [],
        todoItems: cached.todoItems || [],
        plannerItems: cached.plannerItems || [],
        discussions: cached.discussions || {},
        pages: cached.pages || {},
        files: cached.files || {},
        lastUpdate: cached.lastUpdate || null
      };
      console.log('Canvas data restored from cache, last updated:', canvasData.lastUpdate);
      return true;
    }
  } catch (error) {
    console.error('Failed to load Canvas data from storage:', error);
  }
  return false;
}

// Send Canvas data to MCP server via HTTP
async function sendDataToMCPServer() {
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        courses: canvasData.courses,
        assignments: canvasData.assignments,
        allAssignments: canvasData.allAssignments || [],
        calendarEvents: canvasData.calendarEvents || [],
        upcomingEvents: canvasData.upcomingEvents || [],
        submissions: canvasData.submissions || {},
        modules: canvasData.modules || {},
        analytics: canvasData.analytics || {},
        userProfile: canvasData.userProfile || null,
        grades: canvasData.grades || {},
        assignmentGroups: canvasData.assignmentGroups || {},
        announcements: canvasData.announcements || {},
        missingSubmissions: canvasData.missingSubmissions || [],
        todoItems: canvasData.todoItems || [],
        plannerItems: canvasData.plannerItems || [],
        discussions: canvasData.discussions || {},
        pages: canvasData.pages || {},
        files: canvasData.files || {}
      })
    });

    if (response.ok) {
      mcpServerConnected = true;
    } else {
      mcpServerConnected = false;
    }
  } catch (error) {
    mcpServerConnected = false;
  }
}

// Check MCP server health
async function checkMCPServerHealth() {
  try {
    const response = await fetch('http://localhost:8765/health');
    if (response.ok) {
      mcpServerConnected = true;
      return true;
    }
  } catch (error) {
    mcpServerConnected = false;
  }
  return false;
}

// Get configured Canvas URL from storage
async function getConfiguredCanvasUrl() {
  try {
    const result = await chrome.storage.local.get(['canvasUrl']);
    return result.canvasUrl || 'https://canvas.university.edu'; // Default fallback
  } catch (error) {
    return 'https://canvas.university.edu';
  }
}

// Helper function to detect if a URL is a Canvas instance
function isCanvasUrl(url) {
  if (!url) return false;

  const canvasPatterns = [
    // Match canvas.*.edu (e.g., canvas.university.edu)
    /^https?:\/\/canvas\.[^\/]*\.edu/i,
    // Match *.edu/canvas (e.g., university.edu/canvas)
    /^https?:\/\/[^\/]*\.edu\/.*canvas/i,
  ];

  return canvasPatterns.some(pattern => pattern.test(url));
}

// Auto-detect and save Canvas URLs from visited tabs
async function detectAndSaveCanvasUrl(url) {
  if (!isCanvasUrl(url)) return;

  try {
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // Get existing detected URLs
    const result = await chrome.storage.local.get(['detectedCanvasUrls']);
    const detectedUrls = result.detectedCanvasUrls || [];

    // Check if this URL already exists
    const existingIndex = detectedUrls.findIndex(item => item.url === baseUrl);

    if (existingIndex >= 0) {
      // Update timestamp
      detectedUrls[existingIndex].lastSeen = new Date().toISOString();
    } else {
      // Add new URL
      detectedUrls.unshift({
        url: baseUrl,
        lastSeen: new Date().toISOString()
      });
    }

    // Keep only 10 most recent
    const trimmedUrls = detectedUrls.slice(0, 10);

    await chrome.storage.local.set({ detectedCanvasUrls: trimmedUrls });
  } catch (error) {
    // Silent error handling
  }
}

// Helper function to get active Canvas tab
async function getCanvasTab() {
  return new Promise(async (resolve, reject) => {
    // Get configured Canvas URL
    const result = await chrome.storage.local.get(['canvasUrl']);
    const configuredUrl = result.canvasUrl;

    // If no URL is configured yet, don't create a tab with default value
    if (!configuredUrl) {
      reject(new Error('No Canvas URL configured'));
      return;
    }

    const configuredDomain = new URL(configuredUrl).hostname;

    // Build query patterns - include configured domain and common Canvas domains
    const queryPatterns = [
      `*://${configuredDomain}/*`,
      '*://*.instructure.com/*',
      '*://*.canvaslms.com/*'
    ];

    // First try to find any open Canvas tab
    chrome.tabs.query({ url: queryPatterns }, (tabs) => {
      if (tabs && tabs.length > 0) {
        // Prefer configured domain if available
        const preferredTab = tabs.find(tab => tab.url && tab.url.includes(configuredDomain));
        resolve(preferredTab || tabs[0]);
      } else {
        // No Canvas tab found, create one with configured URL
        chrome.tabs.create({ url: configuredUrl, active: false }, (tab) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(tab);
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }
    });
  });
}

// Helper function to send message to content script
function sendMessageToContent(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CANVAS_DATA') {
    if (request.data.courses) {
      canvasData.courses = request.data.courses;
      canvasData.lastUpdate = new Date().toISOString();
    }
    if (request.data.assignments) {
      if (request.data.courseId) {
        canvasData.assignments[request.data.courseId] = request.data.assignments;
      } else if (typeof request.data.assignments === 'object') {
        Object.assign(canvasData.assignments, request.data.assignments);
      }
    }
    if (request.data.allAssignments) {
      canvasData.allAssignments = request.data.allAssignments;
      canvasData.lastUpdate = new Date().toISOString();
    }
    if (request.data.calendarEvents) {
      canvasData.calendarEvents = request.data.calendarEvents;
      canvasData.lastUpdate = new Date().toISOString();
    }
    if (request.data.upcomingEvents) {
      canvasData.upcomingEvents = request.data.upcomingEvents;
      canvasData.lastUpdate = new Date().toISOString();
    }
    if (request.data.submissions) {
      if (request.data.courseId) {
        canvasData.submissions[request.data.courseId] = request.data.submissions;
      } else if (typeof request.data.submissions === 'object') {
        Object.assign(canvasData.submissions, request.data.submissions);
      }
    }
    if (request.data.modules) {
      if (request.data.courseId) {
        canvasData.modules[request.data.courseId] = request.data.modules;
      } else if (typeof request.data.modules === 'object') {
        Object.assign(canvasData.modules, request.data.modules);
      }
    }
    if (request.data.analytics) {
      if (request.data.courseId) {
        canvasData.analytics[request.data.courseId] = request.data.analytics;
      } else if (typeof request.data.analytics === 'object') {
        Object.assign(canvasData.analytics, request.data.analytics);
      }
    }
    if (request.data.userProfile) {
      canvasData.userProfile = request.data.userProfile;
      canvasData.lastUpdate = new Date().toISOString();
    }
    if (request.data.grades) {
      Object.assign(canvasData.grades, request.data.grades);
    }
    if (request.data.assignmentGroups) {
      Object.assign(canvasData.assignmentGroups, request.data.assignmentGroups);
    }
    if (request.data.announcements) {
      Object.assign(canvasData.announcements, request.data.announcements);
    }
    if (request.data.missingSubmissions) {
      canvasData.missingSubmissions = request.data.missingSubmissions;
      canvasData.lastUpdate = new Date().toISOString();
    }
    if (request.data.todoItems) {
      canvasData.todoItems = request.data.todoItems;
      canvasData.lastUpdate = new Date().toISOString();
    }
    if (request.data.plannerItems) {
      canvasData.plannerItems = request.data.plannerItems;
      canvasData.lastUpdate = new Date().toISOString();
    }
    if (request.data.discussions) {
      Object.assign(canvasData.discussions, request.data.discussions);
    }
    if (request.data.pages) {
      Object.assign(canvasData.pages, request.data.pages);
    }
    if (request.data.files) {
      Object.assign(canvasData.files, request.data.files);
    }

    // Send updated data to MCP server
    sendDataToMCPServer();

    // Save to persistent storage
    saveCanvasDataToStorage();

    sendResponse({ status: 'stored' });
  }

  if (request.type === 'MCP_REQUEST') {
    handleMCPRequest(request.payload)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.type === 'GET_MCP_STATUS') {
    // Check MCP server health asynchronously
    checkMCPServerHealth().then(() => {
      sendResponse({
        status: 'active',
        toolCount: MCP_TOOLS.length,
        dataLastUpdate: canvasData.lastUpdate,
        courseCount: canvasData.courses.length,
        nativeHostConnected: mcpServerConnected
      });
    });
    return true; // Keep channel open for async response
  }

  if (request.type === 'GET_CANVAS_DATA') {
    sendResponse({
      success: true,
      data: canvasData,
      dataLastUpdate: canvasData.lastUpdate
    });
    return true;
  }

  if (request.type === 'REFRESH_DATA') {
    getCanvasTab()
      .then(async (tab) => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          await new Promise(resolve => setTimeout(resolve, 500));

          // Fetch all data types in parallel
          const [
            coursesResponse,
            allAssignmentsResponse,
            calendarEventsResponse,
            upcomingEventsResponse,
            userProfileResponse,
            missingSubmissionsResponse,
            todoItemsResponse,
            plannerItemsResponse
          ] = await Promise.all([
            sendMessageToContent(tab.id, { type: 'FETCH_COURSES' }),
            sendMessageToContent(tab.id, { type: 'FETCH_ALL_ASSIGNMENTS' }),
            sendMessageToContent(tab.id, { type: 'FETCH_CALENDAR_EVENTS' }),
            sendMessageToContent(tab.id, { type: 'FETCH_UPCOMING_EVENTS' }),
            sendMessageToContent(tab.id, { type: 'FETCH_USER_PROFILE' }),
            sendMessageToContent(tab.id, { type: 'FETCH_MISSING_SUBMISSIONS' }),
            sendMessageToContent(tab.id, { type: 'FETCH_TODO_ITEMS' }),
            sendMessageToContent(tab.id, { type: 'FETCH_PLANNER_ITEMS' })
          ]);

          // Build comprehensive response
          const data = {
            courses: coursesResponse?.success ? coursesResponse.data : [],
            allAssignments: allAssignmentsResponse?.success ? allAssignmentsResponse.data : [],
            calendarEvents: calendarEventsResponse?.success ? calendarEventsResponse.data : [],
            upcomingEvents: upcomingEventsResponse?.success ? upcomingEventsResponse.data : [],
            userProfile: userProfileResponse?.success ? userProfileResponse.data : null,
            missingSubmissions: missingSubmissionsResponse?.success ? missingSubmissionsResponse.data : [],
            todoItems: todoItemsResponse?.success ? todoItemsResponse.data : [],
            plannerItems: plannerItemsResponse?.success ? plannerItemsResponse.data : [],
            assignments: {} // Legacy format for backwards compatibility
          };

          // Update in-memory cache
          if (data.courses.length > 0) {
            canvasData.courses = data.courses;
          }
          if (data.allAssignments.length > 0) {
            canvasData.allAssignments = data.allAssignments;
          }
          if (data.calendarEvents.length > 0) {
            canvasData.calendarEvents = data.calendarEvents;
          }
          if (data.upcomingEvents.length > 0) {
            canvasData.upcomingEvents = data.upcomingEvents;
          }
          if (data.userProfile) {
            canvasData.userProfile = data.userProfile;
          }
          if (missingSubmissionsResponse?.success) {
            canvasData.missingSubmissions = missingSubmissionsResponse.data;
          }
          if (todoItemsResponse?.success) {
            canvasData.todoItems = todoItemsResponse.data;
          }
          if (plannerItemsResponse?.success) {
            canvasData.plannerItems = plannerItemsResponse.data;
          }
          canvasData.lastUpdate = new Date().toISOString();

          // Send to MCP server
          sendDataToMCPServer();

          // Save to persistent storage
          saveCanvasDataToStorage();

          sendResponse({ success: true, data: data });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

});

async function handleMCPRequest(payload) {
  const { method, params } = payload;


  switch(method) {
    case 'initialize':
      return {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "canvas-mcp-server",
          version: "1.0.0"
        },
        capabilities: {
          tools: {}
        }
      };

    case 'tools/list':
      return {
        tools: MCP_TOOLS
      };

    case 'tools/call':
      return await handleToolCall(params);

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

async function handleToolCall(params) {
  const { name, arguments: args } = params;

  switch(name) {
    case 'list_courses':
      if (canvasData.courses.length === 0) {
        try {
          const tab = await getCanvasTab();
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          await new Promise(resolve => setTimeout(resolve, 500));
          const response = await sendMessageToContent(tab.id, { type: 'FETCH_COURSES' });
          if (response && response.success) {
            canvasData.courses = response.data;
            canvasData.lastUpdate = new Date().toISOString();
          }
        } catch (error) {
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            courses: canvasData.courses,
            count: canvasData.courses.length,
            lastUpdate: canvasData.lastUpdate
          }, null, 2)
        }]
      };

    case 'get_course_assignments':
      const courseId = args.course_id;
      let assignments = canvasData.assignments[courseId] || [];

      if (assignments.length === 0) {
        try {
          const tab = await getCanvasTab();
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          await new Promise(resolve => setTimeout(resolve, 500));
          const response = await sendMessageToContent(tab.id, {
            type: 'FETCH_ASSIGNMENTS',
            courseId: courseId
          });
          if (response && response.success) {
            assignments = response.data;
            canvasData.assignments[courseId] = assignments;
          }
        } catch (error) {
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            courseId: courseId,
            assignments: assignments,
            count: assignments.length
          }, null, 2)
        }]
      };

    case 'list_all_assignments':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_ALL_ASSIGNMENTS' });

        const allAssignments = response?.success ? response.data : [];

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              assignments: allAssignments,
              count: allAssignments.length,
              fetchedAt: new Date().toISOString()
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: error.message }, null, 2)
          }]
        };
      }

    case 'get_assignment_details':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, {
          type: 'FETCH_ASSIGNMENT_DETAILS',
          courseId: args.course_id,
          assignmentId: args.assignment_id
        });

        if (response?.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } else {
          throw new Error(response?.error || 'Failed to fetch assignment details');
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: error.message }, null, 2)
          }]
        };
      }

    case 'list_calendar_events':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, {
          type: 'FETCH_CALENDAR_EVENTS',
          startDate: args.start_date,
          endDate: args.end_date
        });

        const events = response?.success ? response.data : [];

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              events: events,
              count: events.length,
              dateRange: {
                start: args.start_date || 'Not specified',
                end: args.end_date || 'Not specified'
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: error.message }, null, 2)
          }]
        };
      }

    case 'get_user_submissions':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, {
          type: 'FETCH_USER_SUBMISSIONS',
          courseId: args.course_id
        });

        const submissions = response?.success ? response.data : [];

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              courseId: args.course_id,
              submissions: submissions,
              count: submissions.length
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: error.message }, null, 2)
          }]
        };
      }

    case 'list_course_modules':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, {
          type: 'FETCH_COURSE_MODULES',
          courseId: args.course_id
        });

        const modules = response?.success ? response.data : [];

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              courseId: args.course_id,
              modules: modules,
              count: modules.length
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: error.message }, null, 2)
          }]
        };
      }

    case 'list_upcoming_events':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_UPCOMING_EVENTS' });

        const events = response?.success ? response.data : [];

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              upcomingEvents: events,
              count: events.length
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: error.message }, null, 2)
          }]
        };
      }

    case 'get_course_analytics':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, {
          type: 'FETCH_COURSE_ANALYTICS',
          courseId: args.course_id
        });

        if (response?.success && response.data) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                courseId: args.course_id,
                note: 'Analytics data not available for this Canvas instance or course'
              }, null, 2)
            }]
          };
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: error.message,
              note: 'Analytics may not be available on all Canvas instances'
            }, null, 2)
          }]
        };
      }

    case 'get_user_profile':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_USER_PROFILE' });

        if (response?.success && response.data) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(response.data, null, 2)
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: 'Failed to fetch user profile'
              }, null, 2)
            }]
          };
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: error.message }, null, 2)
          }]
        };
      }

    case 'get_course_grades':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));

        if (args.course_id) {
          const response = await sendMessageToContent(tab.id, { type: 'FETCH_COURSE_GRADES', courseId: args.course_id });
          return { content: [{ type: "text", text: JSON.stringify(response?.success ? response.data : { error: 'Failed to fetch grades' }, null, 2) }] };
        }

        // All courses
        const courses = canvasData.courses.length > 0 ? canvasData.courses :
          ((await sendMessageToContent(tab.id, { type: 'FETCH_COURSES' }))?.data || []);
        const gradesResults = await Promise.all(
          courses.map(c => sendMessageToContent(tab.id, { type: 'FETCH_COURSE_GRADES', courseId: c.id }))
        );
        const allGrades = courses.map((c, i) => ({
          courseId: c.id,
          courseName: c.name,
          grades: gradesResults[i]?.success ? gradesResults[i].data : null
        }));
        return { content: [{ type: "text", text: JSON.stringify({ grades: allGrades, count: allGrades.length }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    case 'get_assignment_groups':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_ASSIGNMENT_GROUPS', courseId: args.course_id });
        return { content: [{ type: "text", text: JSON.stringify({ courseId: args.course_id, groups: response?.success ? response.data : [] }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    case 'get_course_announcements':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_COURSE_ANNOUNCEMENTS', courseId: args.course_id });
        const announcements = response?.success ? response.data : [];
        return { content: [{ type: "text", text: JSON.stringify({ courseId: args.course_id, announcements, count: announcements.length }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    case 'get_missing_submissions':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_MISSING_SUBMISSIONS' });
        const missing = response?.success ? response.data : canvasData.missingSubmissions;
        return { content: [{ type: "text", text: JSON.stringify({ missingSubmissions: missing, count: missing.length }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    case 'get_todo_items':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_TODO_ITEMS' });
        const todos = response?.success ? response.data : canvasData.todoItems;
        return { content: [{ type: "text", text: JSON.stringify({ todoItems: todos, count: todos.length }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    case 'get_planner_items':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_PLANNER_ITEMS' });
        const planner = response?.success ? response.data : canvasData.plannerItems;
        return { content: [{ type: "text", text: JSON.stringify({ plannerItems: planner, count: planner.length }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    case 'get_course_discussions':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_DISCUSSION_TOPICS', courseId: args.course_id });
        const discussions = response?.success ? response.data : [];
        return { content: [{ type: "text", text: JSON.stringify({ courseId: args.course_id, discussions, count: discussions.length }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    case 'get_course_pages':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_COURSE_PAGES', courseId: args.course_id });
        const pages = response?.success ? response.data : [];
        return { content: [{ type: "text", text: JSON.stringify({ courseId: args.course_id, pages, count: pages.length }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    case 'get_course_files':
      try {
        const tab = await getCanvasTab();
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 500));
        const response = await sendMessageToContent(tab.id, { type: 'FETCH_COURSE_FILES', courseId: args.course_id });
        const files = response?.success ? response.data : [];
        return { content: [{ type: "text", text: JSON.stringify({ courseId: args.course_id, files, count: files.length }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
      }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Keep service worker alive
if (chrome.alarms) {
  try {
    chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      // Keep alive ping
    });
  } catch (error) {
    // Silent error handling
  }
}

// Listen for tab updates to auto-detect Canvas URLs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    detectAndSaveCanvasUrl(tab.url);
  }
});

// Listen for tab activation to detect Canvas URLs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      detectAndSaveCanvasUrl(tab.url);
    }
  } catch (error) {
    // Silent error handling
  }
});

// Load cached Canvas data on startup, then check MCP server
loadCanvasDataFromStorage().then(hasCache => {
  checkMCPServerHealth().then(connected => {
    if (connected && canvasData.courses.length > 0) {
      // Send any existing Canvas data
      sendDataToMCPServer();
    }
  });
});

// Listen for Canvas URL changes and auto-refresh data
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.canvasUrl) {
    const oldUrl = changes.canvasUrl.oldValue;
    const newUrl = changes.canvasUrl.newValue;

    if (oldUrl !== newUrl && newUrl) {
      console.log(`Canvas URL changed from ${oldUrl} to ${newUrl} - refreshing data...`);

      // Clear existing data since we're switching Canvas instances
      canvasData = {
        courses: [],
        assignments: {},
        allAssignments: [],
        calendarEvents: [],
        upcomingEvents: [],
        submissions: {},
        modules: {},
        analytics: {},
        userProfile: null,
        grades: {},
        assignmentGroups: {},
        announcements: {},
        missingSubmissions: [],
        todoItems: [],
        plannerItems: [],
        discussions: {},
        pages: {},
        files: {},
        lastUpdate: null
      };

      // Trigger automatic data refresh
      getCanvasTab()
        .then(async (tab) => {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            await new Promise(resolve => setTimeout(resolve, 500));

            // Fetch all data types in parallel
            const [
              coursesResponse,
              allAssignmentsResponse,
              calendarEventsResponse,
              upcomingEventsResponse,
              userProfileResponse
            ] = await Promise.all([
              sendMessageToContent(tab.id, { type: 'FETCH_COURSES' }),
              sendMessageToContent(tab.id, { type: 'FETCH_ALL_ASSIGNMENTS' }),
              sendMessageToContent(tab.id, { type: 'FETCH_CALENDAR_EVENTS' }),
              sendMessageToContent(tab.id, { type: 'FETCH_UPCOMING_EVENTS' }),
              sendMessageToContent(tab.id, { type: 'FETCH_USER_PROFILE' })
            ]);

            // Update in-memory cache
            if (coursesResponse?.success && coursesResponse.data.length > 0) {
              canvasData.courses = coursesResponse.data;
            }
            if (allAssignmentsResponse?.success && allAssignmentsResponse.data.length > 0) {
              canvasData.allAssignments = allAssignmentsResponse.data;
            }
            if (calendarEventsResponse?.success && calendarEventsResponse.data.length > 0) {
              canvasData.calendarEvents = calendarEventsResponse.data;
            }
            if (upcomingEventsResponse?.success && upcomingEventsResponse.data.length > 0) {
              canvasData.upcomingEvents = upcomingEventsResponse.data;
            }
            if (userProfileResponse?.success && userProfileResponse.data) {
              canvasData.userProfile = userProfileResponse.data;
            }
            canvasData.lastUpdate = new Date().toISOString();

            // Send to MCP server
            sendDataToMCPServer();

            // Save to persistent storage
            saveCanvasDataToStorage();

            console.log(`Data refreshed successfully from new Canvas instance: ${newUrl}`);
          } catch (error) {
            console.error(`Failed to refresh data after Canvas URL change: ${error.message}`);
          }
        })
        .catch(error => {
          console.error(`Failed to get Canvas tab for auto-refresh: ${error.message}`);
        });
    }
  }
});

