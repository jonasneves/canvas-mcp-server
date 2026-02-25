#!/usr/bin/env node

/**
 * Canvas MCP Server for Claude Desktop
 *
 * - HTTP Server (localhost:8765) receives Canvas data from Chrome Extension
 * - STDIO protocol communicates with Claude Desktop using MCP
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const readline = require('readline');
const config = require('./config');

// Configuration
const HTTP_PORT = config.httpPort;
const LOG_FILE = config.logFile || path.join(process.env.HOME || process.env.USERPROFILE, 'canvas-mcp-host.log');

// In-memory cache for Canvas data
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

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;

  try {
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (error) {
    process.stderr.write(`[ERROR] Failed to write to log file: ${error.message}\n`);
  }

  // Log to stderr (won't interfere with stdout MCP protocol)
  if (config.verboseLogging || level === 'ERROR' || level === 'WARN') {
    process.stderr.write(logMessage);
  }
}

function logError(message, error) {
  const errorDetails = error ? ` - ${error.message}\n${error.stack}` : '';
  log(`${message}${errorDetails}`, 'ERROR');
}

function logWarn(message) {
  log(message, 'WARN');
}

function logDebug(message) {
  if (config.verboseLogging) {
    log(message, 'DEBUG');
  }
}

log('Canvas MCP Server started');

// ============================================================================
// HTTP Request Handler (for Chrome Extension)
// ============================================================================

function handleRequest(req, res) {
  // Enable CORS
  const allowedOrigin = config.cors.allowedOrigins[0] || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // POST /canvas-data - Receive Canvas data from extension
  if (req.method === 'POST' && parsedUrl.pathname === '/canvas-data') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (data.courses) {
          canvasData.courses = data.courses;
          log(`Received ${data.courses.length} courses from extension`);
        }

        if (data.assignments) {
          Object.assign(canvasData.assignments, data.assignments);
          log(`Received assignments for ${Object.keys(data.assignments).length} courses`);
        }

        if (data.allAssignments) {
          canvasData.allAssignments = data.allAssignments;
          log(`Received ${data.allAssignments.length} total assignments`);
        }

        if (data.calendarEvents) {
          canvasData.calendarEvents = data.calendarEvents;
          log(`Received ${data.calendarEvents.length} calendar events`);
        }

        if (data.upcomingEvents) {
          canvasData.upcomingEvents = data.upcomingEvents;
          log(`Received ${data.upcomingEvents.length} upcoming events`);
        }

        if (data.submissions) {
          Object.assign(canvasData.submissions, data.submissions);
          log(`Received submissions for course ${Object.keys(data.submissions).join(', ')}`);
        }

        if (data.modules) {
          Object.assign(canvasData.modules, data.modules);
          log(`Received modules for course ${Object.keys(data.modules).join(', ')}`);
        }

        if (data.analytics) {
          Object.assign(canvasData.analytics, data.analytics);
          log(`Received analytics for course ${Object.keys(data.analytics).join(', ')}`);
        }

        if (data.userProfile) {
          canvasData.userProfile = data.userProfile;
          log(`Received user profile for ${data.userProfile.name}`);
        }

        if (data.grades) {
          Object.assign(canvasData.grades, data.grades);
          log(`Received grades for ${Object.keys(data.grades).length} courses`);
        }

        if (data.assignmentGroups) {
          Object.assign(canvasData.assignmentGroups, data.assignmentGroups);
          log(`Received assignment groups for ${Object.keys(data.assignmentGroups).length} courses`);
        }

        if (data.announcements) {
          Object.assign(canvasData.announcements, data.announcements);
          log(`Received announcements for ${Object.keys(data.announcements).length} courses`);
        }

        if (data.missingSubmissions) {
          canvasData.missingSubmissions = data.missingSubmissions;
          log(`Received ${data.missingSubmissions.length} missing submissions`);
        }

        if (data.todoItems) {
          canvasData.todoItems = data.todoItems;
          log(`Received ${data.todoItems.length} to-do items`);
        }

        if (data.plannerItems) {
          canvasData.plannerItems = data.plannerItems;
          log(`Received ${data.plannerItems.length} planner items`);
        }

        if (data.discussions) {
          Object.assign(canvasData.discussions, data.discussions);
          log(`Received discussions for ${Object.keys(data.discussions).length} courses`);
        }

        if (data.pages) {
          Object.assign(canvasData.pages, data.pages);
          log(`Received pages for ${Object.keys(data.pages).length} courses`);
        }

        if (data.files) {
          Object.assign(canvasData.files, data.files);
          log(`Received files for ${Object.keys(data.files).length} courses`);
        }

        canvasData.lastUpdate = new Date().toISOString();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', received: true }));

      } catch (error) {
        logError('Error parsing Canvas data', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          message: 'Failed to parse Canvas data',
          details: error.message
        }));
      }
    });

    return;
  }

  // GET /canvas-data - Return current Canvas data (for debugging)
  if (req.method === 'GET' && parsedUrl.pathname === '/canvas-data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(canvasData, null, 2));
    return;
  }

  // GET /health - Health check
  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      coursesCount: canvasData.courses.length,
      lastUpdate: canvasData.lastUpdate
    }));
    return;
  }

  // GET / - Server info
  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Canvas MCP Server',
      version: '1.0.0',
      mode: 'Claude Desktop Extension',
      endpoints: {
        canvasData: '/canvas-data',
        health: '/health'
      }
    }, null, 2));
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
}

// ============================================================================
// HTTP Server (for Chrome Extension)
// ============================================================================

const httpServer = http.createServer(handleRequest);

// ============================================================================
// MCP Protocol Handler
// ============================================================================

async function handleMCPRequest(request) {
  const { method, params, id } = request;

  try {
    let result;

    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "canvas-mcp-server",
            version: "1.0.0"
          },
          capabilities: {
            tools: {}
          }
        };
        break;

      case 'tools/list':
        result = {
          tools: [
            {
              name: "list_courses",
              description: "Get list of all Canvas courses for the current user",
              inputSchema: {
                type: "object",
                properties: {},
                required: []
              }
            },
            {
              name: "get_course_assignments",
              description: "Get assignments for a specific course",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: {
                    type: "string",
                    description: "The Canvas course ID"
                  }
                },
                required: ["course_id"]
              }
            },
            {
              name: "list_all_assignments",
              description: "Get all assignments across all courses with submission status - ideal for dashboard views",
              inputSchema: {
                type: "object",
                properties: {},
                required: []
              }
            },
            {
              name: "get_assignment_details",
              description: "Get detailed information about a specific assignment including description, rubrics, and submission status",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: {
                    type: "string",
                    description: "The Canvas course ID"
                  },
                  assignment_id: {
                    type: "string",
                    description: "The Canvas assignment ID"
                  }
                },
                required: ["course_id", "assignment_id"]
              }
            },
            {
              name: "list_calendar_events",
              description: "Get calendar events and assignments within a date range",
              inputSchema: {
                type: "object",
                properties: {
                  start_date: {
                    type: "string",
                    description: "Start date in ISO 8601 format (optional)"
                  },
                  end_date: {
                    type: "string",
                    description: "End date in ISO 8601 format (optional)"
                  }
                },
                required: []
              }
            },
            {
              name: "get_user_submissions",
              description: "Get all submissions for the current user in a specific course",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: {
                    type: "string",
                    description: "The Canvas course ID"
                  }
                },
                required: ["course_id"]
              }
            },
            {
              name: "list_course_modules",
              description: "Get all modules and module items for a course",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: {
                    type: "string",
                    description: "The Canvas course ID"
                  }
                },
                required: ["course_id"]
              }
            },
            {
              name: "list_upcoming_events",
              description: "Get upcoming events and assignments for the current user",
              inputSchema: {
                type: "object",
                properties: {},
                required: []
              }
            },
            {
              name: "get_course_analytics",
              description: "Get analytics data for a course (page views, participations, tardiness) - may not be available on all Canvas instances",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: {
                    type: "string",
                    description: "The Canvas course ID"
                  }
                },
                required: ["course_id"]
              }
            },
            {
              name: "get_user_profile",
              description: "Get the current user's profile information including name, email, avatar, bio, pronouns, and timezone",
              inputSchema: {
                type: "object",
                properties: {},
                required: []
              }
            },
            {
              name: "get_course_grades",
              description: "Get current and final grades for a course. Omit course_id to get grades for all active courses.",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: { type: "string", description: "The Canvas course ID (optional)" }
                },
                required: []
              }
            },
            {
              name: "get_assignment_groups",
              description: "Get assignment groups with grade weights for a course (e.g. Homework 20%, Exams 50%)",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: { type: "string", description: "The Canvas course ID" }
                },
                required: ["course_id"]
              }
            },
            {
              name: "get_course_announcements",
              description: "Get recent announcements posted by instructors in a course",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: { type: "string", description: "The Canvas course ID" }
                },
                required: ["course_id"]
              }
            },
            {
              name: "get_missing_submissions",
              description: "Get all missing/unsubmitted assignments across all courses",
              inputSchema: {
                type: "object",
                properties: {},
                required: []
              }
            },
            {
              name: "get_todo_items",
              description: "Get the user's Canvas to-do list (unsubmitted assignments, unread items)",
              inputSchema: {
                type: "object",
                properties: {},
                required: []
              }
            },
            {
              name: "get_planner_items",
              description: "Get upcoming planner items including assignments, quizzes, and student-created to-dos",
              inputSchema: {
                type: "object",
                properties: {},
                required: []
              }
            },
            {
              name: "get_course_discussions",
              description: "Get discussion topics for a course",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: { type: "string", description: "The Canvas course ID" }
                },
                required: ["course_id"]
              }
            },
            {
              name: "get_course_pages",
              description: "Get pages (wiki/syllabus) for a course",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: { type: "string", description: "The Canvas course ID" }
                },
                required: ["course_id"]
              }
            },
            {
              name: "get_course_files",
              description: "Get files uploaded to a course",
              inputSchema: {
                type: "object",
                properties: {
                  course_id: { type: "string", description: "The Canvas course ID" }
                },
                required: ["course_id"]
              }
            }
          ]
        };
        break;

      case 'tools/call':
        const toolName = params.name;

        if (toolName === 'list_courses') {
          const coursesData = {
            courses: canvasData.courses,
            count: canvasData.courses.length,
            lastUpdate: canvasData.lastUpdate
          };

          if (canvasData.courses.length === 0) {
            coursesData.note = "No courses data available. Make sure the Chrome extension is running and has fetched Canvas data.";
          }

          result = {
            content: [{
              type: "text",
              text: JSON.stringify(coursesData, null, 2)
            }]
          };

        } else if (toolName === 'get_course_assignments') {
          const courseId = params.arguments.course_id;
          const assignments = canvasData.assignments[courseId] || [];

          const assignmentsData = {
            courseId: courseId,
            assignments: assignments,
            count: assignments.length
          };

          if (assignments.length === 0) {
            assignmentsData.note = "No assignments found for this course. Make sure the Chrome extension has fetched assignment data.";
          }

          result = {
            content: [{
              type: "text",
              text: JSON.stringify(assignmentsData, null, 2)
            }]
          };

        } else if (toolName === 'list_all_assignments') {
          const allAssignmentsData = {
            assignments: canvasData.allAssignments,
            count: canvasData.allAssignments.length,
            lastUpdate: canvasData.lastUpdate
          };

          if (canvasData.allAssignments.length === 0) {
            allAssignmentsData.note = "No assignments data available. Make sure the Chrome extension has fetched all assignments.";
          }

          result = {
            content: [{
              type: "text",
              text: JSON.stringify(allAssignmentsData, null, 2)
            }]
          };

        } else if (toolName === 'get_assignment_details') {
          // For assignment details, the extension would need to fetch this on-demand
          // This is a placeholder that indicates the data needs to be fetched
          result = {
            content: [{
              type: "text",
              text: JSON.stringify({
                note: "Assignment details need to be fetched on-demand. Use the Chrome extension to fetch specific assignment details.",
                requestedCourseId: params.arguments.course_id,
                requestedAssignmentId: params.arguments.assignment_id
              }, null, 2)
            }]
          };

        } else if (toolName === 'list_calendar_events') {
          const eventsData = {
            events: canvasData.calendarEvents,
            count: canvasData.calendarEvents.length,
            lastUpdate: canvasData.lastUpdate
          };

          if (canvasData.calendarEvents.length === 0) {
            eventsData.note = "No calendar events available. Make sure the Chrome extension has fetched calendar data.";
          }

          result = {
            content: [{
              type: "text",
              text: JSON.stringify(eventsData, null, 2)
            }]
          };

        } else if (toolName === 'get_user_submissions') {
          const courseId = params.arguments.course_id;
          const submissions = canvasData.submissions[courseId] || [];

          const submissionsData = {
            courseId: courseId,
            submissions: submissions,
            count: submissions.length
          };

          if (submissions.length === 0) {
            submissionsData.note = "No submissions found for this course. Make sure the Chrome extension has fetched submission data.";
          }

          result = {
            content: [{
              type: "text",
              text: JSON.stringify(submissionsData, null, 2)
            }]
          };

        } else if (toolName === 'list_course_modules') {
          const courseId = params.arguments.course_id;
          const modules = canvasData.modules[courseId] || [];

          const modulesData = {
            courseId: courseId,
            modules: modules,
            count: modules.length
          };

          if (modules.length === 0) {
            modulesData.note = "No modules found for this course. Make sure the Chrome extension has fetched module data.";
          }

          result = {
            content: [{
              type: "text",
              text: JSON.stringify(modulesData, null, 2)
            }]
          };

        } else if (toolName === 'list_upcoming_events') {
          const upcomingData = {
            upcomingEvents: canvasData.upcomingEvents,
            count: canvasData.upcomingEvents.length,
            lastUpdate: canvasData.lastUpdate
          };

          if (canvasData.upcomingEvents.length === 0) {
            upcomingData.note = "No upcoming events available. Make sure the Chrome extension has fetched upcoming events.";
          }

          result = {
            content: [{
              type: "text",
              text: JSON.stringify(upcomingData, null, 2)
            }]
          };

        } else if (toolName === 'get_course_analytics') {
          const courseId = params.arguments.course_id;
          const analytics = canvasData.analytics[courseId] || null;

          if (analytics) {
            result = {
              content: [{
                type: "text",
                text: JSON.stringify(analytics, null, 2)
              }]
            };
          } else {
            result = {
              content: [{
                type: "text",
                text: JSON.stringify({
                  courseId: courseId,
                  note: "Analytics data not available for this course. Analytics may not be enabled on this Canvas instance."
                }, null, 2)
              }]
            };
          }

        } else if (toolName === 'get_user_profile') {
          const userProfile = canvasData.userProfile || null;

          if (userProfile) {
            result = {
              content: [{
                type: "text",
                text: JSON.stringify(userProfile, null, 2)
              }]
            };
          } else {
            result = {
              content: [{
                type: "text",
                text: JSON.stringify({
                  note: "User profile not available. Make sure the Chrome extension has fetched the user profile."
                }, null, 2)
              }]
            };
          }

        } else if (toolName === 'get_course_grades') {
          const courseId = params.arguments?.course_id;

          if (courseId) {
            const grades = canvasData.grades[courseId] || null;
            result = {
              content: [{ type: "text", text: JSON.stringify(
                grades || { courseId, note: "Grades not available. Refresh Canvas data." },
                null, 2
              ) }]
            };
          } else {
            const allGrades = canvasData.courses.map(c => ({
              courseId: c.id,
              courseName: c.name,
              grades: canvasData.grades[c.id] || null
            }));
            result = {
              content: [{ type: "text", text: JSON.stringify(
                { grades: allGrades, count: allGrades.length },
                null, 2
              ) }]
            };
          }

        } else if (toolName === 'get_assignment_groups') {
          const courseId = params.arguments.course_id;
          const groups = canvasData.assignmentGroups[courseId] || [];
          result = {
            content: [{ type: "text", text: JSON.stringify(
              { courseId, groups, count: groups.length,
                note: groups.length === 0 ? "No data. Fetch assignment groups via the Chrome extension." : undefined },
              null, 2
            ) }]
          };

        } else if (toolName === 'get_course_announcements') {
          const courseId = params.arguments.course_id;
          const announcements = canvasData.announcements[courseId] || [];
          result = {
            content: [{ type: "text", text: JSON.stringify(
              { courseId, announcements, count: announcements.length,
                note: announcements.length === 0 ? "No announcements cached. Refresh Canvas data." : undefined },
              null, 2
            ) }]
          };

        } else if (toolName === 'get_missing_submissions') {
          result = {
            content: [{ type: "text", text: JSON.stringify(
              { missingSubmissions: canvasData.missingSubmissions, count: canvasData.missingSubmissions.length,
                lastUpdate: canvasData.lastUpdate },
              null, 2
            ) }]
          };

        } else if (toolName === 'get_todo_items') {
          result = {
            content: [{ type: "text", text: JSON.stringify(
              { todoItems: canvasData.todoItems, count: canvasData.todoItems.length,
                lastUpdate: canvasData.lastUpdate },
              null, 2
            ) }]
          };

        } else if (toolName === 'get_planner_items') {
          result = {
            content: [{ type: "text", text: JSON.stringify(
              { plannerItems: canvasData.plannerItems, count: canvasData.plannerItems.length,
                lastUpdate: canvasData.lastUpdate },
              null, 2
            ) }]
          };

        } else if (toolName === 'get_course_discussions') {
          const courseId = params.arguments.course_id;
          const discussions = canvasData.discussions[courseId] || [];
          result = {
            content: [{ type: "text", text: JSON.stringify(
              { courseId, discussions, count: discussions.length,
                note: discussions.length === 0 ? "No discussions cached. Refresh Canvas data." : undefined },
              null, 2
            ) }]
          };

        } else if (toolName === 'get_course_pages') {
          const courseId = params.arguments.course_id;
          const pages = canvasData.pages[courseId] || [];
          result = {
            content: [{ type: "text", text: JSON.stringify(
              { courseId, pages, count: pages.length,
                note: pages.length === 0 ? "No pages cached. Refresh Canvas data." : undefined },
              null, 2
            ) }]
          };

        } else if (toolName === 'get_course_files') {
          const courseId = params.arguments.course_id;
          const files = canvasData.files[courseId] || [];
          result = {
            content: [{ type: "text", text: JSON.stringify(
              { courseId, files, count: files.length,
                note: files.length === 0 ? "No files cached. Refresh Canvas data." : undefined },
              null, 2
            ) }]
          };

        } else {
          throw new Error(`Unknown tool: ${toolName}`);
        }
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return {
      jsonrpc: "2.0",
      id: id,
      result: result
    };

  } catch (error) {
    logError('Error in MCP handler', error);
    return {
      jsonrpc: "2.0",
      id: id,
      error: {
        code: -32603,
        message: error.message,
        data: config.verboseLogging ? error.stack : undefined
      }
    };
  }
}

// ============================================================================
// Server Startup
// ============================================================================

// Start HTTP server for Chrome Extension
httpServer.listen(HTTP_PORT, 'localhost', () => {
  log(`HTTP server listening on http://localhost:${HTTP_PORT}`);
  log(`Extension endpoint: http://localhost:${HTTP_PORT}/canvas-data`);
});

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logError(`Port ${HTTP_PORT} is already in use. Please change the port in config.js or set CANVAS_MCP_PORT environment variable.`, error);
  } else {
    logError('HTTP server error', error);
  }
  process.exit(1);
});

// Start STDIO handler for Claude Desktop
log('Starting STDIO handler for Claude Desktop');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    logDebug(`MCP Request: ${request.method}`);

    const response = await handleMCPRequest(request);

    // Send response via stdout (newline-delimited JSON)
    process.stdout.write(JSON.stringify(response) + '\n');
    logDebug(`MCP Response sent for: ${request.method}`);

  } catch (error) {
    logError('Error handling MCP request', error);

    // Send error response
    const errorResponse = {
      jsonrpc: "2.0",
      error: {
        code: -32700,
        message: 'Parse error: Invalid JSON received',
        data: config.verboseLogging ? error.message : undefined
      }
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

rl.on('close', () => {
  log('STDIO connection closed');
  httpServer.close();
  process.exit(0);
});

log('Server ready - waiting for Canvas data and MCP requests');

// Handle process termination
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down');
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down');
  httpServer.close();
  process.exit(0);
});
