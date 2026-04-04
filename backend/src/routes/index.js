const express = require("express");
const authRoutes = require("./auth.routes");
const usersRoutes = require("./users.routes");
const plansRoutes = require("./plans.routes");
const workoutsRoutes = require("./workouts.routes");
const runsRoutes = require("./runs.routes");
const recordsRoutes = require("./records.routes");
const aiRoutes = require("./ai.routes");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "gymie-backend",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/plans", plansRoutes);
router.use("/workouts", workoutsRoutes);
router.use("/runs", runsRoutes);
router.use("/records", recordsRoutes);
router.use("/ai", aiRoutes);

module.exports = router;
