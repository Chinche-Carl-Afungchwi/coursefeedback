import { Eta } from "https://deno.land/x/eta@v3.4.0/src/index.ts";
import { Hono } from "https://deno.land/x/hono@v3.12.11/mod.ts";
import { getSignedCookie, setSignedCookie } from "https://deno.land/x/hono@v3.12.11/helper.ts";

const eta = new Eta({ views: `${Deno.cwd()}/templates/` });
const app = new Hono();

const secret = "secret";
const courses = [];
const feedbackRecords = new Map();

app.get("/", async (c) => {
  return c.redirect("/courses");
});

app.get("/courses", async (c) => {
  return c.html(await eta.render("courses.eta", { courses }));
});

app.post("/courses", async (c) => {
  const body = await c.req.parseBody();
  const courseName = body.courseName;

  if (!courseName || courseName.length < 4) {
    return c.html(
      await eta.render("courses.eta", {
        error: "The course name should be a string of at least 4 characters.",
        courses,
      }),
    );
  }

  courses.push(courseName);
  return c.redirect("/courses");
});

app.get("/courses/:id", async (c) => {
  const courseId = parseInt(c.req.param("id"));
  const courseName = courses[courseId];

  if (!courseName) {
    return c.text("Course not found.", 404);
  }

  const sessionId = await getSignedCookie(c, secret, "sessionId") ?? crypto.randomUUID();
  await setSignedCookie(c, "sessionId", sessionId, secret, { path: "/" });

  const userFeedbackKey = `${sessionId}-${courseId}`;
  const feedbackGiven = feedbackRecords.has(userFeedbackKey);

  return c.html(
    await eta.render("course.eta", {
      courseName,
      courseId,
      feedbackGiven,
    }),
  );
});

app.post("/courses/:id/feedback", async (c) => {
  const courseId = parseInt(c.req.param("id"));
  const courseName = courses[courseId];

  if (!courseName) {
    return c.text("Course not found.", 404);
  }

  const sessionId = await getSignedCookie(c, secret, "sessionId") ?? crypto.randomUUID();
  await setSignedCookie(c, "sessionId", sessionId, secret, { path: "/" });

  const userFeedbackKey = `${sessionId}-${courseId}`;
  const feedbackType = (await c.req.parseBody()).feedback;

  if (!feedbackRecords.has(userFeedbackKey)) {
    feedbackRecords.set(userFeedbackKey, { good: 0, fair: 0, poor: 0 });
  }

  const feedbackCounts = feedbackRecords.get(userFeedbackKey);
  feedbackCounts[feedbackType] = (feedbackCounts[feedbackType] || 0) + 1;

  return c.redirect(`/courses/${courseId}`);
});

export default app;
