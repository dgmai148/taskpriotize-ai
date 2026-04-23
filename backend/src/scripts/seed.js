const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const fetch = require('node-fetch');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5050';

const DEMO_USERS = [
  { email: 'admin@taskprio.com', password: 'admin123', name: 'Alice Admin', role: 'admin', avatar_color: '#4f46e5' },
  { email: 'pm@taskprio.com', password: 'pm123', name: 'Bob PM', role: 'pm', avatar_color: '#7c3aed' },
  { email: 'dev@taskprio.com', password: 'dev123', name: 'Charlie Dev', role: 'developer', avatar_color: '#16a34a' },
];

const PROJECTS = [
  { name: 'E-Commerce Platform', description: 'Build a modern e-commerce platform with microservices architecture' },
  { name: 'Mobile Health App', description: 'Cross-platform health tracking and telemedicine application' },
];

const TASK_TEMPLATES = [
  // Project 1 tasks
  [
    { title: 'Design database schema', description: 'Create ERD and normalize tables for orders, products, users', story_points: 5, manual_priority: 'high', status: 'done', days_due: -5 },
    { title: 'Implement user authentication', description: 'JWT-based auth with social login support', story_points: 8, manual_priority: 'critical', status: 'done', days_due: -2 },
    { title: 'Build product catalog API', description: 'RESTful endpoints for CRUD operations on products', story_points: 5, manual_priority: 'high', status: 'in_progress', days_due: 3 },
    { title: 'Implement shopping cart', description: 'Session-based cart with persistent storage for logged-in users', story_points: 8, manual_priority: 'high', status: 'open', days_due: 7 },
    { title: 'Payment gateway integration', description: 'Stripe integration with webhook handling', story_points: 13, manual_priority: 'critical', status: 'open', days_due: 10 },
    { title: 'Order management system', description: 'Order lifecycle, status tracking, email notifications', story_points: 8, manual_priority: 'high', status: 'open', days_due: 14 },
    { title: 'Search and filtering', description: 'Elasticsearch-powered product search with faceted filtering', story_points: 8, manual_priority: 'medium', status: 'open', days_due: 12 },
    { title: 'Admin dashboard', description: 'Back-office panel for inventory, orders, analytics', story_points: 13, manual_priority: 'medium', status: 'open', days_due: 20 },
    { title: 'Performance optimization', description: 'Redis caching, CDN setup, query optimization', story_points: 5, manual_priority: 'low', status: 'open', days_due: 25 },
    { title: 'CI/CD pipeline setup', description: 'GitHub Actions for testing, building, and deploying', story_points: 5, manual_priority: 'medium', status: 'in_progress', days_due: 5 },
    { title: 'Mobile responsive design', description: 'Ensure all pages work on mobile and tablet', story_points: 5, manual_priority: 'medium', status: 'open', days_due: 18 },
    { title: 'Inventory management', description: 'Stock tracking, low-stock alerts, supplier integration', story_points: 8, manual_priority: 'high', status: 'open', days_due: 15 },
    { title: 'Review and rating system', description: 'Product reviews with moderation queue', story_points: 5, manual_priority: 'low', status: 'open', days_due: 22 },
    { title: 'Wishlist feature', description: 'User wishlists with sharing capabilities', story_points: 3, manual_priority: 'low', status: 'open', days_due: 28 },
    { title: 'API documentation', description: 'OpenAPI/Swagger docs for all endpoints', story_points: 3, manual_priority: 'medium', status: 'open', days_due: 16 },
  ],
  // Project 2 tasks
  [
    { title: 'Health data model design', description: 'Schema for vitals, medications, appointments', story_points: 5, manual_priority: 'high', status: 'done', days_due: -3 },
    { title: 'HIPAA compliance audit', description: 'Ensure data handling meets HIPAA requirements', story_points: 13, manual_priority: 'critical', status: 'in_progress', days_due: 5 },
    { title: 'Wearable device sync API', description: 'Integration with Fitbit, Apple Health, Google Fit', story_points: 13, manual_priority: 'high', status: 'open', days_due: 8 },
    { title: 'Appointment booking system', description: 'Calendar-based scheduling with provider availability', story_points: 8, manual_priority: 'high', status: 'open', days_due: 10 },
    { title: 'Video consultation module', description: 'WebRTC-based video calls between patient and doctor', story_points: 13, manual_priority: 'critical', status: 'open', days_due: 12 },
    { title: 'Medication tracker', description: 'Reminders, dosage logging, refill alerts', story_points: 5, manual_priority: 'medium', status: 'open', days_due: 15 },
    { title: 'Health dashboard charts', description: 'D3.js visualizations for vitals trends over time', story_points: 8, manual_priority: 'medium', status: 'open', days_due: 14 },
    { title: 'Push notification service', description: 'FCM/APNs integration for appointment and med reminders', story_points: 5, manual_priority: 'medium', status: 'open', days_due: 18 },
    { title: 'Prescription management', description: 'Digital prescriptions with pharmacy integration', story_points: 8, manual_priority: 'high', status: 'open', days_due: 20 },
    { title: 'Patient onboarding flow', description: 'Multi-step form for medical history intake', story_points: 5, manual_priority: 'medium', status: 'open', days_due: 7 },
    { title: 'Data export feature', description: 'Export health records as PDF and FHIR format', story_points: 5, manual_priority: 'low', status: 'open', days_due: 25 },
    { title: 'Emergency contacts module', description: 'Quick-access emergency contacts and medical ID', story_points: 3, manual_priority: 'medium', status: 'open', days_due: 16 },
    { title: 'Insurance verification API', description: 'Real-time eligibility checking with payers', story_points: 8, manual_priority: 'high', status: 'open', days_due: 22 },
    { title: 'Accessibility audit (ADA)', description: 'Screen reader support, contrast ratios, keyboard nav', story_points: 5, manual_priority: 'medium', status: 'open', days_due: 24 },
    { title: 'Load testing and scaling', description: 'k6 load tests, horizontal scaling configuration', story_points: 5, manual_priority: 'low', status: 'open', days_due: 30 },
  ],
];

// Dependencies: index pairs [taskIndex, dependsOnIndex]
const DEPENDENCIES = [
  // Project 1
  [[2, 0], [3, 2], [4, 1], [5, 3], [5, 4], [7, 5], [6, 2], [10, 2], [11, 2], [12, 2], [8, 6]],
  // Project 2
  [[2, 0], [3, 0], [4, 1], [6, 0], [7, 3], [8, 1], [9, 0], [10, 6], [12, 1], [13, 9]],
];

async function seed() {
  // Check if DB already has users
  const existing = await pool.query('SELECT COUNT(*) as cnt FROM users');
  if (parseInt(existing.rows[0].cnt) > 0) {
    console.log('[Seed] Database already has data, skipping seed.');
    return;
  }

  console.log('[Seed] Seeding database...');

  // Create users
  const userIds = [];
  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, avatar_color) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [u.email, hash, u.name, u.role, u.avatar_color]
    );
    userIds.push(result.rows[0].id);
  }
  console.log(`[Seed] Created ${userIds.length} users`);

  // Create projects
  const projectIds = [];
  for (const p of PROJECTS) {
    const result = await pool.query(
      'INSERT INTO projects (name, description, owner_id) VALUES ($1,$2,$3) RETURNING id',
      [p.name, p.description, userIds[1]] // PM owns projects
    );
    projectIds.push(result.rows[0].id);
  }
  console.log(`[Seed] Created ${projectIds.length} projects`);

  // Create tasks
  for (let pi = 0; pi < PROJECTS.length; pi++) {
    const taskIds = [];
    const templates = TASK_TEMPLATES[pi];

    for (let ti = 0; ti < templates.length; ti++) {
      const t = templates[ti];
      const assignee = userIds[ti % 3]; // Rotate assignees
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + t.days_due);

      const result = await pool.query(
        `INSERT INTO tasks (project_id, title, description, status, manual_priority, assignee_id, created_by, story_points, due_date, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [projectIds[pi], t.title, t.description, t.status, t.manual_priority, assignee, userIds[1], t.story_points, dueDate, t.status === 'done' ? new Date() : null]
      );
      taskIds.push(result.rows[0].id);
    }

    // Create dependencies
    const deps = DEPENDENCIES[pi];
    for (const [taskIdx, depIdx] of deps) {
      await pool.query(
        'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [taskIds[taskIdx], taskIds[depIdx]]
      );
    }

    // Update dependency counts
    for (let ti = 0; ti < taskIds.length; ti++) {
      const countResult = await pool.query(
        'SELECT COUNT(*) as cnt FROM task_dependencies WHERE task_id = $1',
        [taskIds[ti]]
      );
      await pool.query('UPDATE tasks SET dependency_count = $1 WHERE id = $2', [
        countResult.rows[0].cnt, taskIds[ti],
      ]);
    }

    console.log(`[Seed] Created ${templates.length} tasks for "${PROJECTS[pi].name}"`);
  }

  // Run AI prioritization on seeded tasks
  console.log('[Seed] Running AI prioritization on seeded data...');
  for (const projectId of projectIds) {
    try {
      const tasksResult = await pool.query(
        `SELECT t.*,
                (SELECT COUNT(*) FROM task_dependencies td WHERE td.task_id = t.id) as dep_count,
                (SELECT COUNT(*) FROM task_dependencies td WHERE td.depends_on_id = t.id) as blocked_count
         FROM tasks t WHERE t.project_id = $1`,
        [projectId]
      );

      const mlPayload = tasksResult.rows.map(t => ({
        id: t.id,
        features: {
          story_points: t.story_points || 0,
          manual_priority: { low: 0.2, medium: 0.5, high: 0.8, critical: 1.0 }[t.manual_priority] || 0.5,
          dependency_count: parseInt(t.dep_count) || 0,
          blocked_tasks_count: parseInt(t.blocked_count) || 0,
          days_until_due: t.due_date
            ? Math.max(0, Math.ceil((new Date(t.due_date) - new Date()) / (1000 * 60 * 60 * 24)))
            : 30,
          status_progress: { open: 0, in_progress: 0.3, review: 0.7, done: 1.0, blocked: 0.1 }[t.status] || 0,
          age_days: Math.ceil((new Date() - new Date(t.created_at)) / (1000 * 60 * 60 * 24)),
        },
      }));

      const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: mlPayload }),
      });

      if (mlResponse.ok) {
        const predictions = await mlResponse.json();
        for (const pred of predictions.results) {
          await pool.query(
            'UPDATE tasks SET ai_priority_score = $1, ai_explanation = $2 WHERE id = $3',
            [pred.score, JSON.stringify(pred.explanation), pred.id]
          );
        }
        console.log(`[Seed] AI scores updated for project ${projectId}`);
      } else {
        console.warn('[Seed] ML service not available; tasks seeded without AI scores');
      }
    } catch (err) {
      console.warn('[Seed] ML service call failed:', err.message);
    }
  }

  console.log('[Seed] Seeding complete!');
}

module.exports = { seed };
