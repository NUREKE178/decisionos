// Vercel zero-config serverless function, served at /api/version.
// Reports the live deployment's commit SHA so the client (src/lib/useAutoUpdate.js)
// can detect a new deploy and reload -- no build step, no file to keep in sync by
// hand, since VERCEL_GIT_COMMIT_SHA is set by Vercel itself on every deploy.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).json({
    version: process.env.VERCEL_GIT_COMMIT_SHA || null,
    env: process.env.VERCEL_ENV || "development",
  });
};
