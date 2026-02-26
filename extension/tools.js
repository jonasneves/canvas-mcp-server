// Canonical MCP tool definitions — shared by extension/background.js (via importScripts)
// and native-host/host.js (via require). Do not duplicate these elsewhere.

const MCP_TOOLS = [
  {
    name: "list_courses",
    description: "Get list of all Canvas courses for the current user",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_course_assignments",
    description: "Get assignments for a specific course",
    inputSchema: {
      type: "object",
      properties: {
        course_id: { type: "string", description: "The Canvas course ID" }
      },
      required: ["course_id"]
    }
  },
  {
    name: "list_all_assignments",
    description: "Get all assignments across all courses with submission status - ideal for dashboard views",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_assignment_details",
    description: "Get detailed information about a specific assignment including description, rubrics, and submission status",
    inputSchema: {
      type: "object",
      properties: {
        course_id: { type: "string", description: "The Canvas course ID" },
        assignment_id: { type: "string", description: "The Canvas assignment ID" }
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
        start_date: { type: "string", description: "Start date in ISO 8601 format (optional)" },
        end_date: { type: "string", description: "End date in ISO 8601 format (optional)" }
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
        course_id: { type: "string", description: "The Canvas course ID" }
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
        course_id: { type: "string", description: "The Canvas course ID" }
      },
      required: ["course_id"]
    }
  },
  {
    name: "list_upcoming_events",
    description: "Get upcoming events and assignments for the current user",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_course_analytics",
    description: "Get analytics data for a course (page views, participations, tardiness) - may not be available on all Canvas instances",
    inputSchema: {
      type: "object",
      properties: {
        course_id: { type: "string", description: "The Canvas course ID" }
      },
      required: ["course_id"]
    }
  },
  {
    name: "get_user_profile",
    description: "Get the current user's profile information including name, email, avatar, bio, pronouns, and timezone",
    inputSchema: { type: "object", properties: {}, required: [] }
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
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_todo_items",
    description: "Get the user's Canvas to-do list (unsubmitted assignments, unread items)",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_planner_items",
    description: "Get upcoming planner items including assignments, quizzes, and student-created to-dos",
    inputSchema: { type: "object", properties: {}, required: [] }
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
];

// Node.js (native-host) — export for require()
if (typeof module !== 'undefined') module.exports = { MCP_TOOLS };
