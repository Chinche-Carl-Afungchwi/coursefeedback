import { Hono } from "https://deno.land/x/hono@v3.12.11/mod.ts";
import { getSignedCookie, setSignedCookie } from "https://deno.land/x/hono@v3.12.11/helper.ts";
import { Eta } from "https://deno.land/x/eta@v3.4.0/src/index.ts";

const app = new Hono();
const eta = new Eta({ views: `${Deno.cwd()}/templates` });

const courses = new Map();
const secret = "secret";

app.get("/", (c) => {
  return c.redirect("/courses");
});

app.get("/courses", (c) => {
  return c.html(
    eta.render("courses.eta", {
      courses: Array.from(courses.keys()),
    }),
  );
});

app.post("/courses", async (c) => {
  const body = await c.req.parseBody();
  const courseName = body.courseName;

  if (!courseName || courseName.length < 4) {
    return c.html(
      eta.render("courses.eta", {
        error: "The course name should be a string of at least 4 characters.",
        courses: Array.from(courses.keys()),
      }),
    );
  }

  if (!courses.has(courseName)) {
    courses.set(courseName, { Excellent: 0, Good: 0, Fair: 0, Poor: 0 });
  }

  return c.redirect("/courses");
});

app.get("/courses/:course", async (c) => {
  const courseName = c.req.param("course");
  const feedback = courses.get(courseName);

  if (!feedback) {
    return c.text("Course not found", 404);
  }

  const sessionId = await getSignedCookie(c, secret, "sessionId") ?? crypto.randomUUID();
  await setSignedCookie(c, "sessionId", sessionId, secret, { path: "/" });

  const feedbackGiven = (await getSignedCookie(c, secret, sessionId)) === courseName;

  return c.html(
    eta.render("course.eta", {
      courseName,
      feedback,
      feedbackGiven,
    }),
  );
});

app.post("/courses/:course/feedback", async (c) => {
  const courseName = c.req.param("course");
  const feedbackType = (await c.req.parseBody()).feedback;

  const feedback = courses.get(courseName);

  if (!feedback || !["Excellent", "Good", "Fair", "Poor"].includes(feedbackType)) {
    return c.text("Course not found", 404);
  }

  const sessionId = await getSignedCookie(c, secret, "sessionId");
  if (!sessionId) {
    return c.redirect(`/courses/${courseName}`);
  }

  await setSignedCookie(c, sessionId, courseName, secret, { path: "/" });
  feedback[feedbackType]++;
  return c.redirect(`/courses/${courseName}`);
});

export default app;
