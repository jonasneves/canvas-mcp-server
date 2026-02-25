// Canvas MCP Server - Content Script
(function() {
  'use strict';

  // Prevent multiple executions
  if (window.canvasMCPInitialized) {
    return;
  }
  window.canvasMCPInitialized = true;

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
      const url = `${API_BASE}/courses?enrollment_state=active&completed=false&include[]=term&include[]=favorites&per_page=100`;
      const courses = await fetchJsonWithPagination(url, 200);
      return courses.map(course => ({
        id: String(course.id),
        name: course.name,
        code: course.course_code,
        term: course.term?.name || course.term?.id || null,
        startAt: course.start_at || null,
        endAt: course.end_at || null,
        enrollmentType: course.enrollments?.[0]?.type || null,
        isFavorite: course.is_favorite || false,
        url: `${window.location.origin}/courses/${course.id}`
      }));
    } catch (error) {
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
              assignmentGroupId: assignment.assignment_group_id ? String(assignment.assignment_group_id) : null,
              omitFromFinalGrade: assignment.omit_from_final_grade || false,
              position: assignment.position || null,
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
          // Continue with other courses
        }
      }

      return allAssignments;
    } catch (error) {
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
      return [];
    }
  }

  async function fetchUserSubmissions(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/students/submissions?student_ids[]=self&include[]=assignment&include[]=submission_comments&per_page=100`;
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
        previewUrl: submission.preview_url,
        comments: (submission.submission_comments || []).map(c => ({
          id: String(c.id),
          comment: c.comment,
          authorName: c.author_name,
          createdAt: c.created_at
        }))
      }));
    } catch (error) {
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
          published: item.published,
          completionRequirement: item.completion_requirement || null,
          completed: item.completion_requirement?.completed || false
        }))
      }));
    } catch (error) {
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
      return null;
    }
  }

  async function fetchUserProfile() {
    try {
      const url = `${API_BASE}/users/self/profile`;
      const profile = await fetchJson(url);

      return {
        id: String(profile.id),
        name: profile.name,
        shortName: profile.short_name,
        sortableName: profile.sortable_name,
        primaryEmail: profile.primary_email,
        loginId: profile.login_id,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        pronouns: profile.pronouns,
        pronunciation: profile.pronunciation,
        timeZone: profile.time_zone,
        locale: profile.locale,
        k5User: profile.k5_user
      };
    } catch (error) {
      return null;
    }
  }

  async function fetchCourseGrades(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment&per_page=5`;
      const enrollments = await fetchJsonWithPagination(url, 5);
      if (!enrollments.length) return null;
      const enrollment = enrollments[0];
      return {
        courseId: String(courseId),
        currentGrade: enrollment.grades?.current_grade || null,
        currentScore: enrollment.grades?.current_score || null,
        finalGrade: enrollment.grades?.final_grade || null,
        finalScore: enrollment.grades?.final_score || null,
        enrollmentState: enrollment.enrollment_state
      };
    } catch (error) {
      return null;
    }
  }

  async function fetchAssignmentGroups(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/assignment_groups?include[]=assignments&per_page=100`;
      const groups = await fetchJsonWithPagination(url, 50);
      return groups.map(group => ({
        id: String(group.id),
        name: group.name,
        weight: group.group_weight || 0,
        position: group.position,
        assignments: (group.assignments || []).map(a => ({
          id: String(a.id),
          name: a.name,
          dueDate: a.due_at || null,
          pointsPossible: a.points_possible,
          omitFromFinalGrade: a.omit_from_final_grade || false
        }))
      }));
    } catch (error) {
      return [];
    }
  }

  async function fetchCourseAnnouncements(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/discussion_topics?only_announcements=true&order_by=recent_activity&per_page=20`;
      const announcements = await fetchJsonWithPagination(url, 20);
      return announcements.map(a => ({
        id: String(a.id),
        title: a.title,
        message: a.message || '',
        postedAt: a.posted_at,
        authorName: a.author?.display_name || null,
        url: a.html_url
      }));
    } catch (error) {
      return [];
    }
  }

  async function fetchMissingSubmissions() {
    try {
      const url = `${API_BASE}/users/self/missing_submissions?filter[]=submittable&per_page=50`;
      const submissions = await fetchJsonWithPagination(url, 100);
      return submissions.map(s => ({
        id: String(s.id),
        name: s.name,
        dueDate: s.due_at || null,
        pointsPossible: s.points_possible,
        courseId: s.course_id ? String(s.course_id) : null,
        url: s.html_url
      }));
    } catch (error) {
      return [];
    }
  }

  async function fetchTodoItems() {
    try {
      const url = `${API_BASE}/users/self/todo?per_page=50`;
      const items = await fetchJson(url);
      if (!Array.isArray(items)) return [];
      return items.map(item => ({
        type: item.type,
        assignmentId: item.assignment ? String(item.assignment.id) : null,
        assignmentName: item.assignment?.name || null,
        courseId: item.course_id ? String(item.course_id) : null,
        dueAt: item.assignment?.due_at || null,
        pointsPossible: item.assignment?.points_possible || null,
        htmlUrl: item.html_url
      }));
    } catch (error) {
      return [];
    }
  }

  async function fetchPlannerItems() {
    try {
      const url = `${API_BASE}/planner/items?per_page=50`;
      const items = await fetchJsonWithPagination(url, 100);
      return items.map(item => ({
        plannableType: item.plannable_type,
        plannableId: String(item.plannable_id),
        courseId: item.course_id ? String(item.course_id) : null,
        plannableDate: item.plannable_date,
        title: item.plannable?.title || item.plannable?.name || null,
        dueAt: item.plannable?.due_at || null,
        pointsPossible: item.plannable?.points_possible || null,
        completed: item.planner_override?.marked_complete || false,
        htmlUrl: item.html_url
      }));
    } catch (error) {
      return [];
    }
  }

  async function fetchDiscussionTopics(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/discussion_topics?per_page=50&order_by=recent_activity`;
      const topics = await fetchJsonWithPagination(url, 50);
      return topics.map(t => ({
        id: String(t.id),
        title: t.title,
        postedAt: t.posted_at,
        lastReplyAt: t.last_reply_at,
        isAnnouncement: t.is_announcement || false,
        requireInitialPost: t.require_initial_post || false,
        unreadCount: t.unread_count || 0,
        replyCount: t.discussion_subentry_count || 0,
        url: t.html_url
      }));
    } catch (error) {
      return [];
    }
  }

  async function fetchCoursePages(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/pages?per_page=50&sort=title`;
      const pages = await fetchJsonWithPagination(url, 100);
      return pages.map(p => ({
        url: p.url,
        title: p.title,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        published: p.published,
        frontPage: p.front_page || false,
        htmlUrl: p.html_url
      }));
    } catch (error) {
      return [];
    }
  }

  async function fetchCourseFiles(courseId) {
    try {
      const url = `${API_BASE}/courses/${courseId}/files?per_page=50&sort=updated_at&order=desc`;
      const files = await fetchJsonWithPagination(url, 100);
      return files.map(f => ({
        id: String(f.id),
        displayName: f.display_name,
        filename: f.filename,
        contentType: f.content_type,
        size: f.size,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
        url: f.url,
        htmlUrl: f.html_url
      }));
    } catch (error) {
      return [];
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
        case 'FETCH_USER_PROFILE':
          promise = fetchUserProfile();
          break;
        case 'FETCH_COURSE_GRADES':
          if (!courseId) { sendResponse({ success: false, error: 'courseId required' }); return; }
          promise = fetchCourseGrades(courseId);
          break;
        case 'FETCH_ASSIGNMENT_GROUPS':
          if (!courseId) { sendResponse({ success: false, error: 'courseId required' }); return; }
          promise = fetchAssignmentGroups(courseId);
          break;
        case 'FETCH_COURSE_ANNOUNCEMENTS':
          if (!courseId) { sendResponse({ success: false, error: 'courseId required' }); return; }
          promise = fetchCourseAnnouncements(courseId);
          break;
        case 'FETCH_MISSING_SUBMISSIONS':
          promise = fetchMissingSubmissions();
          break;
        case 'FETCH_TODO_ITEMS':
          promise = fetchTodoItems();
          break;
        case 'FETCH_PLANNER_ITEMS':
          promise = fetchPlannerItems();
          break;
        case 'FETCH_DISCUSSION_TOPICS':
          if (!courseId) { sendResponse({ success: false, error: 'courseId required' }); return; }
          promise = fetchDiscussionTopics(courseId);
          break;
        case 'FETCH_COURSE_PAGES':
          if (!courseId) { sendResponse({ success: false, error: 'courseId required' }); return; }
          promise = fetchCoursePages(courseId);
          break;
        case 'FETCH_COURSE_FILES':
          if (!courseId) { sendResponse({ success: false, error: 'courseId required' }); return; }
          promise = fetchCourseFiles(courseId);
          break;
        case 'FETCH_ALL_DATA':
          promise = (async () => {
            const courses = await fetchCourses();
            const assignmentsData = {};
            for (const course of courses) {
              try {
                assignmentsData[course.id] = await fetchCourseAssignments(course.id);
              } catch (error) {
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
            case 'FETCH_USER_SUBMISSIONS':
              canvasDataPayload = { submissions: { [courseId]: data }, courseId: courseId };
              break;
            case 'FETCH_COURSE_MODULES':
              canvasDataPayload = { modules: { [courseId]: data }, courseId: courseId };
              break;
            case 'FETCH_COURSE_ANALYTICS':
              canvasDataPayload = { analytics: { [courseId]: data }, courseId: courseId };
              break;
            case 'FETCH_USER_PROFILE':
              canvasDataPayload = { userProfile: data };
              break;
            case 'FETCH_COURSE_GRADES':
              canvasDataPayload = { grades: { [courseId]: data }, courseId };
              break;
            case 'FETCH_ASSIGNMENT_GROUPS':
              canvasDataPayload = { assignmentGroups: { [courseId]: data }, courseId };
              break;
            case 'FETCH_COURSE_ANNOUNCEMENTS':
              canvasDataPayload = { announcements: { [courseId]: data }, courseId };
              break;
            case 'FETCH_MISSING_SUBMISSIONS':
              canvasDataPayload = { missingSubmissions: data };
              break;
            case 'FETCH_TODO_ITEMS':
              canvasDataPayload = { todoItems: data };
              break;
            case 'FETCH_PLANNER_ITEMS':
              canvasDataPayload = { plannerItems: data };
              break;
            case 'FETCH_DISCUSSION_TOPICS':
              canvasDataPayload = { discussions: { [courseId]: data }, courseId };
              break;
            case 'FETCH_COURSE_PAGES':
              canvasDataPayload = { pages: { [courseId]: data }, courseId };
              break;
            case 'FETCH_COURSE_FILES':
              canvasDataPayload = { files: { [courseId]: data }, courseId };
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
          sendResponse({ success: false, error: error.message });
        });

      return true;
    });
  }
})();
