import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import workoutRoutes from "./workout-routes";
import reportsRoutes from "./reports-routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler } from "./scheduler";

const app = express();
// Disable ETag to prevent conditional 304 responses on dynamic API routes
app.set('etag', false);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Optional staging noindex header
app.use((req, res, next) => {
  if (process.env.NOINDEX === 'true') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  next();
});

// Force no-store on API responses to avoid 304 Not Modified issues with fetch
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Table creation is now handled by Drizzle migrations (db:push). Ensure you've run migrations before starting.

  // Mount workout routes so /api/workouts endpoints are available
  app.use("/api/workouts", workoutRoutes);
  app.use("/api/reports", reportsRoutes);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use port from environment variable or default to 3001
  const port = parseInt(process.env.PORT || '3001', 10);
  const host = '0.0.0.0';
  
  server.listen(port, host, () => {
    log(`Server is running on http://${host}:${port}`);
    // Start the group message scheduler only when explicitly enabled
    if (process.env.ENABLE_SCHEDULER === 'true') {
      scheduler.start();
    }
  });
  
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.syscall !== 'listen') {
      throw error;
    }

    switch (error.code) {
      case 'EACCES':
        log(`Port ${port} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        log(`Port ${port} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });
})();
