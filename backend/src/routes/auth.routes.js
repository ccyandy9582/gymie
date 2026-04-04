const express = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { asyncHandler } = require("../utils/async-handler");
const { registerUser, loginUser, refreshSession, logoutSession } = require("../services/auth.service");

const router = express.Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    age: z.number().int().min(10).max(100).optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    height_cm: z.number().min(50).max(300).optional(),
    weight_kg: z.number().min(20).max(500).optional(),
    goal: z.enum(["build_muscle", "lose_fat", "endurance", "general_fitness"]).optional(),
    fitness_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    unit_system: z.enum(["metric", "imperial"]).optional(),
    training_type: z.enum(["running", "strength", "hybrid"]).optional(),
    available_days: z.array(z.number().int().min(0).max(6)).min(2).max(7).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await registerUser(req.validated.body);
    res.status(201).json(result);
  }),
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginUser(req.validated.body.email, req.validated.body.password);
    res.status(200).json(result);
  }),
);

router.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = await refreshSession(req.validated.body.refreshToken);
    res.status(200).json(result);
  }),
);

router.delete(
  "/logout",
  validate(logoutSchema),
  asyncHandler(async (req, res) => {
    await logoutSession(req.validated.body.refreshToken);
    res.status(204).send();
  }),
);

module.exports = router;
