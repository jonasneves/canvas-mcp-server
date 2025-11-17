// Canvas MCP Server - Content Script
(function() {
  'use strict';

  // Prevent multiple executions
  if (window.canvasMCPInitialized) {
    console.log('Canvas MCP already initialized, skipping');
    return;
  }
  window.canvasMCPInitialized = true;

  console.log('Canvas MCP content script loaded on:', window.location.href);

  const API_BASE = '/api/v1';

  async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  }

  async function fetchJsonWithPagination(url, maxItems = Infinity) {
    let results = [];
    let nextUrl = url;
    let pageCount = 0;

    while (nextUrl && results.length < maxItems && pageCount < 10) {
      const response = await fetch(nextUrl, { credentials: 'include' });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        results = results.concat(data);
      } else if (data) {
        results.push(data);
      }

      const linkHeader = response.headers.get('link');
      nextUrl = null;

      if (linkHeader) {
        const parts = linkHeader.split(',');
        for (const part of parts) {
          const section = part.split(';');
          if (section.length !== 2) continue;
          const urlPart = section[0].trim().replace(/[<>]/g, '');
          const relPart = section[1].trim();
          if (relPart === 'rel="next"') {
            nextUrl = urlPart;
            break;
          }
        }
      }

      pageCount += 1;
    }

    return results.slice(0, maxItems);
  }

  async function fetchCourses() {
    try {
      const url = `${API_BASE}/courses?enrollment_state=active&completed=false&include[]=term&per_page=100`;
      const courses = await fetchJsonWithPagination(url, 200);
      return courses.map(course => ({
        id: String(course.id),
        name: course.name,
        code: course.course_code,
        term: course.term?.name || course.term?.id || null,
        url: `${window.location.origin}/courses/${course.id}`
      }));
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      return [];
    }
  }

  async function fetchCourseAssignments(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/assignments?per_page=100`;
      const assignments = await fetchJsonWithPagination(url, 100);
      return assignments.map(assignment => ({
        id: String(assignment.id),
        name: assignment.name,
        dueDate: assignment.due_at || null,
        pointsPossible: assignment.points_possible,
        published: assignment.published,
        url: assignment.html_url || `${window.location.origin}/courses/${courseId}/assignments/${assignment.id}`
      }));
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
      return [];
    }
  }

  async function fetchAllAssignments() {
    try {
      // Fetch all active courses first
      const courses = await fetchCourses();
      const allAssignments = [];

      for (const course of courses) {
        try {
          const url = `${API_BASE}/courses/${course.id}/assignments?include[]=submission&per_page=100`;
          const assignments = await fetchJsonWithPagination(url, 100);

          assignments.forEach(assignment => {
            allAssignments.push({
              id: String(assignment.id),
              courseId: String(course.id),
              courseName: course.name,
              name: assignment.name,
              dueDate: assignment.due_at || null,
              lockDate: assignment.lock_at || null,
              unlockDate: assignment.unlock_at || null,
              pointsPossible: assignment.points_possible,
              published: assignment.published,
              submissionTypes: assignment.submission_types || [],
              hasSubmittedSubmissions: assignment.has_submitted_submissions || false,
              gradingType: assignment.grading_type,
              submission: assignment.submission ? {
                submitted: !!assignment.submission.submitted_at,
                submittedAt: assignment.submission.submitted_at,
                grade: assignment.submission.grade,
                score: assignment.submission.score,
                late: assignment.submission.late,
                missing: assignment.submission.missing,
                workflowState: assignment.submission.workflow_state
              } : null,
              url: assignment.html_url || `${window.location.origin}/courses/${course.id}/assignments/${assignment.id}`
            });
          });
        } catch (error) {
          console.error(`Failed to fetch assignments for course ${course.id}:`, error);
        }
      }

      return allAssignments;
    } catch (error) {
      console.error('Failed to fetch all assignments:', error);
      return [];
    }
  }

  async function fetchAssignmentDetails(courseId, assignmentId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/assignments/${assignmentId}?include[]=submission&include[]=rubric_assessment`;
      const assignment = await fetchJson(url);

      return {
        id: String(assignment.id),
        courseId: String(courseId),
        name: assignment.name,
        description: assignment.description,
        dueDate: assignment.due_at || null,
        lockDate: assignment.lock_at || null,
        unlockDate: assignment.unlock_at || null,
        pointsPossible: assignment.points_possible,
        published: assignment.published,
        submissionTypes: assignment.submission_types || [],
        gradingType: assignment.grading_type,
        allowedAttempts: assignment.allowed_attempts,
        rubric: assignment.rubric || null,
        submission: assignment.submission ? {
          submitted: !!assignment.submission.submitted_at,
          submittedAt: assignment.submission.submitted_at,
          grade: assignment.submission.grade,
          score: assignment.submission.score,
          late: assignment.submission.late,
          missing: assignment.submission.missing,
          workflowState: assignment.submission.workflow_state,
          attempt: assignment.submission.attempt,
          previewUrl: assignment.submission.preview_url
        } : null,
        url: assignment.html_url || `${window.location.origin}/courses/${courseId}/assignments/${assignment.id}`
      };
    } catch (error) {
      console.error('Failed to fetch assignment details:', error);
      throw error;
    }
  }

  async function fetchCalendarEvents(startDate = null, endDate = null) {
    try {
      let url = `${API_BASE}/calendar_events?type=assignment&type=event&per_page=100`;

      if (startDate) {
        url += `&start_date=${startDate}`;
      }
      if (endDate) {
        url += `&end_date=${endDate}`;
      }

      const events = await fetchJsonWithPagination(url, 200);

      return events.map(event => ({
        id: String(event.id),
        title: event.title,
        startAt: event.start_at,
        endAt: event.end_at,
        type: event.type,
        contextCode: event.context_code,
        description: event.description,
        assignmentId: event.assignment ? String(event.assignment.id) : null,
        url: event.html_url
      }));
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      return [];
    }
  }

  async function fetchUserSubmissions(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/students/submissions?student_ids[]=self&include[]=assignment&per_page=100`;
      const submissions = await fetchJsonWithPagination(url, 200);

      return submissions.map(submission => ({
        id: String(submission.id),
        assignmentId: String(submission.assignment_id),
        assignmentName: submission.assignment?.name || 'Unknown',
        userId: String(submission.user_id),
        submitted: !!submission.submitted_at,
        submittedAt: submission.submitted_at,
        grade: submission.grade,
        score: submission.score,
        late: submission.late,
        missing: submission.missing,
        excused: submission.excused,
        workflowState: submission.workflow_state,
        attempt: submission.attempt,
        gradedAt: submission.graded_at,
        previewUrl: submission.preview_url
      }));
    } catch (error) {
      console.error('Failed to fetch user submissions:', error);
      return [];
    }
  }

  async function fetchCourseModules(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/modules?include[]=items&per_page=100`;
      const modules = await fetchJsonWithPagination(url, 100);

      return modules.map(module => ({
        id: String(module.id),
        name: module.name,
        position: module.position,
        unlockAt: module.unlock_at,
        requireSequentialProgress: module.require_sequential_progress,
        publishedState: module.published,
        itemsCount: module.items_count,
        items: (module.items || []).map(item => ({
          id: String(item.id),
          title: item.title,
          type: item.type,
          contentId: item.content_id ? String(item.content_id) : null,
          url: item.html_url,
          published: item.published
        }))
      }));
    } catch (error) {
      console.error('Failed to fetch course modules:', error);
      return [];
    }
  }

  async function fetchUpcomingEvents() {
    try {
      const url = `${API_BASE}/users/self/upcoming_events`;
      const events = await fetchJson(url);

      if (!Array.isArray(events)) return [];

      return events.map(event => ({
        id: String(event.id),
        title: event.title,
        type: event.type,
        startAt: event.start_at,
        endAt: event.end_at,
        contextCode: event.context_code,
        assignmentId: event.assignment ? String(event.assignment.id) : null,
        assignment: event.assignment ? {
          id: String(event.assignment.id),
          name: event.assignment.name,
          dueAt: event.assignment.due_at,
          pointsPossible: event.assignment.points_possible
        } : null,
        url: event.html_url
      }));
    } catch (error) {
      console.error('Failed to fetch upcoming events:', error);
      return [];
    }
  }

  async function fetchCourseAnalytics(courseId) {
    try {
      // Try to fetch course analytics (may not be available on all Canvas instances)
      const url = `${API_BASE}/courses/${courseId}/analytics/student_summaries/self`;
      const analytics = await fetchJson(url);

      return {
        courseId: String(courseId),
        pageViews: analytics.page_views,
        participations: analytics.participations,
        tardiness: analytics.tardiness_breakdown
      };
    } catch (error) {
      // Analytics may not be available
      console.warn('Course analytics not available:', error);
      return null;
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, courseId, assignmentId, startDate, endDate } = message;

      let promise;

      switch (type) {
        case 'FETCH_COURSES':
          promise = fetchCourses();
          break;
        case 'FETCH_ASSIGNMENTS':
          if (!courseId) {
            sendResponse({ success: false, error: 'courseId required' });
            return;
          }
          promise = fetchCourseAssignments(courseId);
          break;
        case 'FETCH_ALL_ASSIGNMENTS':
          promise = fetchAllAssignments();
          break;
        case 'FETCH_ASSIGNMENT_DETAILS':
          if (!courseId || !assignmentId) {
            sendResponse({ success: false, error: 'courseId and assignmentId required' });
            return;
          }
          promise = fetchAssignmentDetails(courseId, assignmentId);
          break;
        case 'FETCH_CALENDAR_EVENTS':
          promise = fetchCalendarEvents(startDate, endDate);
          break;
        case 'FETCH_USER_SUBMISSIONS':
          if (!courseId) {
            sendResponse({ success: false, error: 'courseId required' });
            return;
          }
          promise = fetchUserSubmissions(courseId);
          break;
        case 'FETCH_COURSE_MODULES':
          if (!courseId) {
            sendResponse({ success: false, error: 'courseId required' });
            return;
          }
          promise = fetchCourseModules(courseId);
          break;
        case 'FETCH_UPCOMING_EVENTS':
          promise = fetchUpcomingEvents();
          break;
        case 'FETCH_COURSE_ANALYTICS':
          if (!courseId) {
            sendResponse({ success: false, error: 'courseId required' });
            return;
          }
          promise = fetchCourseAnalytics(courseId);
          break;
        case 'FETCH_ALL_DATA':
          promise = (async () => {
            const courses = await fetchCourses();
            const assignmentsData = {};
            for (const course of courses) {
              try {
                assignmentsData[course.id] = await fetchCourseAssignments(course.id);
              } catch (error) {
                console.error(`Failed to fetch assignments for course ${course.id}:`, error);
                assignmentsData[course.id] = [];
              }
            }
            return { courses, assignments: assignmentsData };
          })();
          break;
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
          return;
      }

      promise
        .then(data => {
          sendResponse({ success: true, data });

          // Send data to background - determine type based on message type
          let canvasDataPayload;
          switch (type) {
            case 'FETCH_COURSES':
              canvasDataPayload = { courses: data };
              break;
            case 'FETCH_ALL_ASSIGNMENTS':
              canvasDataPayload = { allAssignments: data };
              break;
            case 'FETCH_CALENDAR_EVENTS':
              canvasDataPayload = { calendarEvents: data };
              break;
            case 'FETCH_UPCOMING_EVENTS':
              canvasDataPayload = { upcomingEvents: data };
              break;
            case 'FETCH_ASSIGNMENTS':
              canvasDataPayload = { assignments: { [courseId]: data } };
              break;
            case 'FETCH_ALL_DATA':
              canvasDataPayload = data; // Already structured correctly
              break;
            default:
              canvasDataPayload = data;
          }

          chrome.runtime.sendMessage({
            type: 'CANVAS_DATA',
            data: canvasDataPayload
          });
        })
        .catch(error => {
          console.error('Canvas MCP content script error:', error);
          sendResponse({ success: false, error: error.message });
        });

      return true;
    });
  }

  console.log('Canvas MCP content script initialized');
})();
