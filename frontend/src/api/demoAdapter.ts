import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Assignment, Project, Task, TaskPriority, TaskStatus, User, UserRole } from '../types';
import { DEMO_ACCOUNT, DEMO_STORAGE_KEY } from './demo';

/**
 * In-browser stand-in for the FastAPI backend, used only by the GitHub Pages
 * demo build. Mirrors the routes, permission rules and error format of
 * app/routers + app/services, persisting everything in localStorage.
 */

// ─── Data model ───────────────────────────────────────────────────────────────

type DemoUser = User & { password: string };
type TaskRow = Omit<Task, 'assignees'>;
type AssignmentRow = Omit<Assignment, 'user'>;

interface MemberRow {
  id: number;
  project_id: number;
  user_id: number;
  joined_at: string;
}

interface DemoDb {
  nextId: number;
  users: DemoUser[];
  projects: Project[];
  members: MemberRow[];
  tasks: TaskRow[];
  assignments: AssignmentRow[];
}

// ─── Errors (same shape as app/exceptions.py) ─────────────────────────────────

interface Failure {
  status: number;
  code: string;
  message: string;
}

function fail(status: number, code: string, message: string): never {
  throw { status, code, message } satisfies Failure;
}

function notFound(message: string): never {
  return fail(404, 'resource_not_found', message);
}

function forbidden(message: string, code = 'permission_denied'): never {
  return fail(403, code, message);
}

function badRequest(message: string): never {
  return fail(400, 'bad_request', message);
}

function invalid(message: string): never {
  return fail(422, 'validation_error', message);
}

// ─── Dates ────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toDateStr(new Date());
const dateIn = (days: number) => toDateStr(new Date(Date.now() + days * DAY));
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const now = () => new Date().toISOString();

// ─── Seed data ────────────────────────────────────────────────────────────────

function seed(): DemoDb {
  const user = (
    id: number,
    username: string,
    email: string,
    role: UserRole,
    age: number,
    is_active = true,
    password = 'Password1'
  ): DemoUser => ({
    id,
    username,
    email,
    role,
    is_active,
    password,
    created_at: daysAgo(age),
    updated_at: daysAgo(age),
  });

  const users = [
    user(1, 'Demo Admin', DEMO_ACCOUNT.email, 'admin', 90, true, DEMO_ACCOUNT.password),
    user(2, 'alice_chen', 'alice@trellolite.dev', 'user', 80),
    user(3, 'bob_martin', 'bob@trellolite.dev', 'user', 72),
    user(4, 'carol_diaz', 'carol@trellolite.dev', 'user', 55),
    user(5, 'dan_kim', 'dan@trellolite.dev', 'user', 20, false),
  ];

  const project = (
    id: number,
    name: string,
    description: string,
    owner_id: number,
    age: number,
    is_archived = false
  ): Project => ({
    id,
    name,
    description,
    owner_id,
    is_archived,
    created_at: daysAgo(age),
    updated_at: daysAgo(age / 2),
  });

  const projects = [
    project(1, 'Website Redesign', 'Refresh the marketing site with the new brand system and a faster, accessible frontend.', 1, 40),
    project(2, 'Mobile App Launch', 'Ship v1.0 of the iOS and Android apps to the stores.', 2, 35),
    project(3, 'Q4 Marketing Campaign', 'Newsletter, webinar and social push for the end-of-year release.', 1, 25),
    project(4, 'Legacy API Migration', 'Move remaining clients off the v1 REST API.', 3, 70, true),
  ];

  let nextId = 1;
  const memberIds: Record<number, number[]> = { 1: [1, 2, 3], 2: [2, 1, 4], 3: [1, 4, 3], 4: [3, 1] };
  const members: MemberRow[] = Object.entries(memberIds).flatMap(([projectId, userIds]) =>
    userIds.map((user_id) => ({
      id: nextId++,
      project_id: Number(projectId),
      user_id,
      joined_at: daysAgo(30),
    }))
  );

  // [project, title, description, status, priority, due (days from today), assignees, creator]
  const taskSeed: [number, string, string | null, TaskStatus, TaskPriority, number | null, number[], number][] = [
    [1, 'Design new landing page hero', 'Explore 3 directions using the new brand palette, then pick one with the team.', 'in_progress', 'high', 3, [2], 1],
    [1, 'Implement responsive navbar', 'Collapsible menu on mobile, sticky on scroll.', 'in_progress', 'medium', 2, [1, 2], 1],
    [1, 'Fix contact form validation', 'Email field accepts invalid addresses; add server error messages.', 'todo', 'high', -1, [1], 2],
    [1, 'Optimize images & lazy loading', 'Convert hero and gallery images to AVIF/WebP.', 'todo', 'high', 5, [2], 1],
    [1, 'Set up design tokens in Tailwind', null, 'todo', 'medium', 7, [1], 1],
    [1, 'Write copy for About page', 'Draft, then review with marketing.', 'todo', 'low', 12, [3], 3],
    [1, 'Audit current site accessibility', 'Run axe + manual keyboard pass, log issues.', 'done', 'medium', -5, [3], 1],
    [1, 'Migrate blog to MDX', null, 'done', 'low', null, [1], 1],
    [2, 'Finalize onboarding flow', 'Three screens max, skippable.', 'in_progress', 'high', 4, [2, 4], 2],
    [2, 'Push notification service', 'Integrate FCM + APNs behind a single interface.', 'todo', 'medium', 10, [1], 2],
    [2, 'App Store screenshots', null, 'todo', 'low', 14, [4], 2],
    [2, 'Crash reporting integration', null, 'done', 'high', null, [1], 1],
    [3, 'Draft email newsletter', 'Highlight the three biggest features of the release.', 'in_progress', 'medium', 2, [4], 1],
    [3, 'Launch webinar landing page', null, 'todo', 'high', 6, [1], 1],
    [3, 'Social media calendar', 'Two posts per week through December.', 'todo', 'low', 9, [3, 1], 4],
    [4, 'Deprecate v1 endpoints', null, 'done', 'medium', null, [3], 3],
    [4, 'Document migration guide', null, 'in_progress', 'low', null, [1], 3],
  ];

  const tasks: TaskRow[] = [];
  const assignments: AssignmentRow[] = [];
  taskSeed.forEach(([project_id, title, description, status, priority, due, assignees, created_by], i) => {
    const id = nextId++;
    const age = taskSeed.length - i;
    tasks.push({
      id,
      title,
      description,
      status,
      priority,
      due_date: due === null ? null : dateIn(due),
      project_id,
      created_by,
      created_at: daysAgo(age),
      updated_at: daysAgo(age / 2),
    });
    for (const user_id of assignees) {
      assignments.push({ id: nextId++, task_id: id, user_id, assigned_by: created_by, assigned_at: daysAgo(age) });
    }
  });

  return { nextId, users, projects, members, tasks, assignments };
}

function loadDb(): DemoDb {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoDb;
  } catch {
    // corrupted or unavailable storage — fall back to fresh seed data
  }
  return seed();
}

function saveDb(db: DemoDb) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage full or blocked — demo keeps working for this request only
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Ctx {
  ids: number[];
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  token: string | null;
}

const str = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : String(v));
const num = (v: unknown) => {
  const s = str(v);
  return s === undefined ? undefined : Number(s);
};
const bool = (v: unknown) => {
  const s = str(v);
  return s === undefined ? undefined : s === 'true';
};
const has = (obj: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

function paginate<T>(items: T[], query: Record<string, unknown>) {
  const limit = num(query.limit) ?? 20;
  const offset = num(query.offset) ?? 0;
  return { total: items.length, limit, offset, items: items.slice(offset, offset + limit) };
}

function publicUser(u: DemoUser): User {
  const { password, ...rest } = u;
  void password;
  return rest;
}

function currentUser(db: DemoDb, ctx: Ctx): DemoUser {
  const match = ctx.token?.match(/^Bearer demo-access\.(\d+)$/);
  if (!match) fail(401, 'token_required', 'Authentication required');
  const user = db.users.find((u) => u.id === Number(match[1]));
  if (!user) fail(401, 'invalid_token', 'User not found');
  if (!user.is_active) forbidden('Account is deactivated', 'account_disabled');
  return user;
}

function requireAdmin(db: DemoDb, ctx: Ctx): DemoUser {
  const user = currentUser(db, ctx);
  if (user.role !== 'admin') forbidden('Admin access required');
  return user;
}

function findUser(db: DemoDb, id: number): DemoUser {
  const user = db.users.find((u) => u.id === id);
  if (!user) notFound('User not found');
  return user;
}

const isMember = (db: DemoDb, projectId: number, userId: number) =>
  db.members.some((m) => m.project_id === projectId && m.user_id === userId);

function accessibleProject(db: DemoDb, projectId: number, user: DemoUser): Project {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) notFound('Project not found');
  if (user.role !== 'admin' && project.owner_id !== user.id && !isMember(db, projectId, user.id)) {
    notFound('Project not found');
  }
  return project;
}

function requireOwnerOrAdmin(project: Project, user: DemoUser, message = 'Only the project owner can perform this action') {
  if (user.role !== 'admin' && project.owner_id !== user.id) forbidden(message);
}

function findTask(db: DemoDb, projectId: number, taskId: number): TaskRow {
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task || task.project_id !== projectId) notFound('Task not found');
  return task;
}

function toTask(db: DemoDb, task: TaskRow): Task {
  const assignees = db.assignments
    .filter((a) => a.task_id === task.id)
    .map((a) => db.users.find((u) => u.id === a.user_id))
    .filter((u): u is DemoUser => !!u)
    .map(({ id, username, email }) => ({ id, username, email }));
  return { ...task, assignees };
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 1, medium: 2, low: 3 };

function sortTasks(tasks: TaskRow[], query: Record<string, unknown>): TaskRow[] {
  const sortBy = str(query.sort_by) ?? 'created_at';
  const sign = str(query.sort_dir) === 'asc' ? 1 : -1;
  const key = (t: TaskRow): number | string => {
    if (sortBy === 'priority') return PRIORITY_RANK[t.priority];
    if (sortBy === 'due_date') return t.due_date ?? '9999-12-31'; // NULLs sort last, like Postgres
    if (sortBy === 'updated_at') return t.updated_at;
    return t.created_at;
  };
  return [...tasks].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -sign : ka > kb ? sign : 0;
  });
}

function filterByStatusPriority(tasks: TaskRow[], query: Record<string, unknown>) {
  const status = str(query.status);
  const priority = str(query.priority);
  return tasks.filter((t) => (!status || t.status === status) && (!priority || t.priority === priority));
}

function assign(db: DemoDb, taskId: number, userId: number, assignedBy: number): AssignmentRow {
  const row = { id: db.nextId++, task_id: taskId, user_id: userId, assigned_by: assignedBy, assigned_at: now() };
  db.assignments.push(row);
  return row;
}

function setActive(db: DemoDb, ctx: Ctx, isActive: boolean): [number, User] {
  requireAdmin(db, ctx);
  const user = findUser(db, ctx.ids[0]);
  user.is_active = isActive;
  user.updated_at = now();
  return [200, publicUser(user)];
}

function deleteProjectCascade(db: DemoDb, projectId: number) {
  const taskIds = new Set(db.tasks.filter((t) => t.project_id === projectId).map((t) => t.id));
  db.assignments = db.assignments.filter((a) => !taskIds.has(a.task_id));
  db.tasks = db.tasks.filter((t) => t.project_id !== projectId);
  db.members = db.members.filter((m) => m.project_id !== projectId);
  db.projects = db.projects.filter((p) => p.id !== projectId);
}

// ─── Validation (same rules as app/schemas) ───────────────────────────────────

function validateUsername(v: unknown): string {
  if (typeof v !== 'string' || v.length < 3 || v.length > 50) invalid('Username must be 3-50 characters');
  if (!/^[a-zA-Z0-9_ ]+$/.test(v)) {
    invalid('Username must contain only alphanumeric characters, underscores, and spaces');
  }
  return v;
}

function validateEmail(v: unknown): string {
  if (typeof v !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) invalid('Enter a valid email address');
  return v;
}

function validatePassword(v: unknown): string {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) invalid('Password must be 8-128 characters');
  if (!/[A-Z]/.test(v)) invalid('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(v)) invalid('Password must contain at least one lowercase letter');
  if (!/\d/.test(v)) invalid('Password must contain at least one digit');
  return v;
}

function validateText(v: unknown, field: string, max: number, required: boolean): string | null {
  if (v === undefined || v === null) {
    if (required) invalid(`${field} must not be blank`);
    return null;
  }
  if (typeof v !== 'string') invalid(`${field} must be a string`);
  if (required && !v.trim()) invalid(`${field} must not be blank`);
  if (v.length > max) invalid(`${field} must be at most ${max} characters`);
  return v;
}

// ─── Routes (mirror app/routers) ──────────────────────────────────────────────

type Handler = (db: DemoDb, ctx: Ctx) => [number, unknown];

const routes: [string, RegExp, Handler][] = [
  // Auth
  ['POST', /^\/auth\/register$/, (db, { body }) => {
    const username = validateUsername(body.username);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      fail(409, 'duplicate_email', 'Email already registered');
    }
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      fail(409, 'duplicate_username', 'Username already taken');
    }
    const role: UserRole = db.users.length === 0 ? 'admin' : 'user';
    const user: DemoUser = { id: db.nextId++, username, email, password, role, is_active: true, created_at: now(), updated_at: now() };
    db.users.push(user);
    return [201, publicUser(user)];
  }],
  ['POST', /^\/auth\/login$/, (db, { body }) => {
    const email = String(body.email ?? '').toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.password !== body.password) fail(401, 'invalid_credentials', 'Invalid credentials');
    if (!user.is_active) forbidden('Account is deactivated', 'account_disabled');
    return [200, { access_token: `demo-access.${user.id}`, refresh_token: `demo-refresh.${user.id}`, token_type: 'bearer' }];
  }],
  ['POST', /^\/auth\/refresh$/, (db, { body }) => {
    const match = String(body.refresh_token ?? '').match(/^demo-refresh\.(\d+)$/);
    if (!match) fail(401, 'invalid_token', 'Invalid refresh token');
    const user = db.users.find((u) => u.id === Number(match[1]));
    if (!user) fail(401, 'invalid_token', 'User not found');
    return [200, { access_token: `demo-access.${user.id}`, token_type: 'bearer' }];
  }],
  ['POST', /^\/auth\/logout$/, (db, ctx) => {
    currentUser(db, ctx);
    return [204, null];
  }],
  ['GET', /^\/auth\/me$/, (db, ctx) => [200, publicUser(currentUser(db, ctx))]],

  // Users
  ['GET', /^\/users$/, (db, ctx) => {
    requireAdmin(db, ctx);
    const users = [...db.users].sort((a, b) => a.id - b.id).map(publicUser);
    return [200, paginate(users, ctx.query)];
  }],
  ['GET', /^\/users\/me$/, (db, ctx) => [200, publicUser(currentUser(db, ctx))]],
  ['GET', /^\/users\/search$/, (db, ctx) => {
    currentUser(db, ctx);
    const q = str(ctx.query.q)?.toLowerCase();
    if (!q) invalid('q must not be empty');
    const found = db.users
      .filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 10);
    return [200, found.map(publicUser)];
  }],
  ['PATCH', /^\/users\/me$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const { body } = ctx;
    const username = body.username == null ? undefined : validateUsername(body.username);
    const email = body.email == null ? undefined : validateEmail(body.email);
    const newPassword = body.new_password == null ? undefined : validatePassword(body.new_password);
    if (username && username !== user.username) {
      if (db.users.some((u) => u.id !== user.id && u.username.toLowerCase() === username.toLowerCase())) {
        fail(409, 'duplicate_username', 'Username already taken');
      }
      user.username = username;
    }
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase())) {
        fail(409, 'duplicate_email', 'Email already registered');
      }
      user.email = email;
    }
    if (newPassword) {
      if (!body.current_password) badRequest('Current password is required to set a new password');
      if (body.current_password !== user.password) badRequest('Current password is incorrect');
      if (newPassword === user.password) badRequest('New password must differ from current password');
      user.password = newPassword;
    }
    user.updated_at = now();
    return [200, publicUser(user)];
  }],
  ['GET', /^\/users\/(\d+)$/, (db, ctx) => {
    requireAdmin(db, ctx);
    return [200, publicUser(findUser(db, ctx.ids[0]))];
  }],
  ['PATCH', /^\/users\/(\d+)\/deactivate$/, (db, ctx) => setActive(db, ctx, false)],
  ['PATCH', /^\/users\/(\d+)\/activate$/, (db, ctx) => setActive(db, ctx, true)],
  ['DELETE', /^\/users\/(\d+)$/, (db, ctx) => {
    requireAdmin(db, ctx);
    const user = findUser(db, ctx.ids[0]);
    db.projects.filter((p) => p.owner_id === user.id).forEach((p) => deleteProjectCascade(db, p.id));
    db.members = db.members.filter((m) => m.user_id !== user.id);
    db.assignments = db.assignments.filter((a) => a.user_id !== user.id);
    db.users = db.users.filter((u) => u.id !== user.id);
    return [204, null];
  }],

  // Projects
  ['GET', /^\/projects$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const archived = bool(ctx.query.is_archived) ?? false;
    const search = str(ctx.query.search)?.toLowerCase();
    const projects = db.projects
      .filter((p) => user.role === 'admin' || p.owner_id === user.id || isMember(db, p.id, user.id))
      .filter((p) => p.is_archived === archived)
      .filter((p) => !search || p.name.toLowerCase().includes(search))
      .sort((a, b) => a.id - b.id);
    return [200, paginate(projects, ctx.query)];
  }],
  ['POST', /^\/projects$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const project: Project = {
      id: db.nextId++,
      name: validateText(ctx.body.name, 'Name', 100, true) as string,
      description: validateText(ctx.body.description, 'Description', 2000, false),
      owner_id: user.id,
      is_archived: false,
      created_at: now(),
      updated_at: now(),
    };
    db.projects.push(project);
    db.members.push({ id: db.nextId++, project_id: project.id, user_id: user.id, joined_at: now() });
    return [201, project];
  }],
  ['GET', /^\/projects\/(\d+)$/, (db, ctx) => [200, accessibleProject(db, ctx.ids[0], currentUser(db, ctx))]],
  ['PATCH', /^\/projects\/(\d+)$/, (db, ctx) => {
    const project = accessibleProject(db, ctx.ids[0], currentUser(db, ctx));
    requireOwnerOrAdmin(project, currentUser(db, ctx));
    if (ctx.body.name != null) project.name = validateText(ctx.body.name, 'Name', 100, true) as string;
    if (ctx.body.description != null) project.description = validateText(ctx.body.description, 'Description', 2000, false);
    project.updated_at = now();
    return [200, project];
  }],
  ['DELETE', /^\/projects\/(\d+)$/, (db, ctx) => {
    const project = accessibleProject(db, ctx.ids[0], currentUser(db, ctx));
    requireOwnerOrAdmin(project, currentUser(db, ctx));
    deleteProjectCascade(db, project.id);
    return [204, null];
  }],
  ['PATCH', /^\/projects\/(\d+)\/archive$/, (db, ctx) => {
    const project = accessibleProject(db, ctx.ids[0], currentUser(db, ctx));
    requireOwnerOrAdmin(project, currentUser(db, ctx));
    project.is_archived = !project.is_archived;
    project.updated_at = now();
    return [200, project];
  }],
  ['GET', /^\/projects\/(\d+)\/members$/, (db, ctx) => {
    const project = accessibleProject(db, ctx.ids[0], currentUser(db, ctx));
    const users = db.members
      .filter((m) => m.project_id === project.id)
      .map((m) => db.users.find((u) => u.id === m.user_id))
      .filter((u): u is DemoUser => !!u)
      .map(publicUser);
    return [200, users];
  }],
  ['POST', /^\/projects\/(\d+)\/members$/, (db, ctx) => {
    const project = accessibleProject(db, ctx.ids[0], currentUser(db, ctx));
    requireOwnerOrAdmin(project, currentUser(db, ctx));
    const target = findUser(db, Number(ctx.body.user_id));
    if (isMember(db, project.id, target.id)) fail(409, 'conflict', 'User is already a member');
    const member = { id: db.nextId++, project_id: project.id, user_id: target.id, joined_at: now() };
    db.members.push(member);
    return [201, { ...member, user: publicUser(target) }];
  }],
  ['DELETE', /^\/projects\/(\d+)\/members\/(\d+)$/, (db, ctx) => {
    const [projectId, userId] = ctx.ids;
    const project = accessibleProject(db, projectId, currentUser(db, ctx));
    requireOwnerOrAdmin(project, currentUser(db, ctx));
    if (!isMember(db, projectId, userId)) notFound('Member not found');
    db.members = db.members.filter((m) => !(m.project_id === projectId && m.user_id === userId));
    return [204, null];
  }],

  // Tasks
  ['GET', /^\/tasks\/mine$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const mine = new Set(db.assignments.filter((a) => a.user_id === user.id).map((a) => a.task_id));
    const tasks = sortTasks(filterByStatusPriority(db.tasks.filter((t) => mine.has(t.id)), ctx.query), ctx.query);
    const page = paginate(tasks, ctx.query);
    return [200, { ...page, items: page.items.map((t) => toTask(db, t)) }];
  }],
  ['GET', /^\/projects\/(\d+)\/tasks$/, (db, ctx) => {
    const project = accessibleProject(db, ctx.ids[0], currentUser(db, ctx));
    const { query } = ctx;
    const assigneeId = num(query.assignee_id);
    const createdBy = num(query.created_by);
    const from = str(query.due_date_from);
    const to = str(query.due_date_to);
    const q = str(query.q)?.toLowerCase();
    if (from && to && from > to) badRequest('due_date_from must not be after due_date_to');
    const assigned = new Set(db.assignments.filter((a) => a.user_id === assigneeId).map((a) => a.task_id));
    const tasks = filterByStatusPriority(db.tasks.filter((t) => t.project_id === project.id), query).filter(
      (t) =>
        (!assigneeId || assigned.has(t.id)) &&
        (!createdBy || t.created_by === createdBy) &&
        (!from || (t.due_date !== null && t.due_date >= from)) &&
        (!to || (t.due_date !== null && t.due_date <= to)) &&
        (bool(query.is_overdue) !== true || (t.due_date !== null && t.due_date < today() && t.status !== 'done')) &&
        (!q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q))
    );
    const page = paginate(sortTasks(tasks, query), query);
    return [200, { ...page, items: page.items.map((t) => toTask(db, t)) }];
  }],
  ['POST', /^\/projects\/(\d+)\/tasks$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const project = accessibleProject(db, ctx.ids[0], user);
    const { body } = ctx;
    const dueDate = str(body.due_date) ?? null;
    if (dueDate && dueDate < today()) badRequest('due_date must not be in the past');
    const task: TaskRow = {
      id: db.nextId++,
      title: validateText(body.title, 'Title', 200, true) as string,
      description: validateText(body.description, 'Description', 5000, false),
      status: (str(body.status) ?? 'todo') as TaskStatus,
      priority: (str(body.priority) ?? 'medium') as TaskPriority,
      due_date: dueDate,
      project_id: project.id,
      created_by: user.id,
      created_at: now(),
      updated_at: now(),
    };
    db.tasks.push(task);
    for (const id of (body.assignee_ids as number[] | undefined) ?? []) assign(db, task.id, id, user.id);
    return [201, toTask(db, task)];
  }],
  ['GET', /^\/projects\/(\d+)\/tasks\/(\d+)$/, (db, ctx) => {
    const project = accessibleProject(db, ctx.ids[0], currentUser(db, ctx));
    return [200, toTask(db, findTask(db, project.id, ctx.ids[1]))];
  }],
  ['PATCH', /^\/projects\/(\d+)\/tasks\/(\d+)$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const project = accessibleProject(db, ctx.ids[0], user);
    const task = findTask(db, project.id, ctx.ids[1]);
    const isAssignee = db.assignments.some((a) => a.task_id === task.id && a.user_id === user.id);
    if (user.role !== 'admin' && project.owner_id !== user.id && task.created_by !== user.id && !isAssignee) {
      forbidden("You don't have permission to update this task");
    }
    const { body } = ctx;
    if (body.title != null) task.title = validateText(body.title, 'Title', 200, true) as string;
    if (has(body, 'description')) task.description = validateText(body.description, 'Description', 5000, false);
    if (body.status != null) task.status = body.status as TaskStatus;
    if (body.priority != null) task.priority = body.priority as TaskPriority;
    if (has(body, 'due_date')) task.due_date = str(body.due_date) ?? null;
    task.updated_at = now();
    if (Array.isArray(body.assignee_ids)) {
      db.assignments = db.assignments.filter((a) => a.task_id !== task.id);
      for (const id of body.assignee_ids as number[]) assign(db, task.id, id, user.id);
    }
    return [200, toTask(db, task)];
  }],
  ['DELETE', /^\/projects\/(\d+)\/tasks\/(\d+)$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const project = accessibleProject(db, ctx.ids[0], user);
    const task = findTask(db, project.id, ctx.ids[1]);
    if (user.role !== 'admin' && project.owner_id !== user.id && task.created_by !== user.id) {
      forbidden('Only project owners or task creators can delete tasks');
    }
    db.assignments = db.assignments.filter((a) => a.task_id !== task.id);
    db.tasks = db.tasks.filter((t) => t.id !== task.id);
    return [204, null];
  }],

  // Assignments
  ['GET', /^\/projects\/(\d+)\/tasks\/(\d+)\/assignments$/, (db, ctx) => {
    const project = accessibleProject(db, ctx.ids[0], currentUser(db, ctx));
    const task = findTask(db, project.id, ctx.ids[1]);
    const rows = db.assignments
      .filter((a) => a.task_id === task.id)
      .map((a) => {
        const assignee = db.users.find((u) => u.id === a.user_id);
        return { ...a, assignee: assignee ? publicUser(assignee) : null };
      });
    return [200, rows];
  }],
  ['POST', /^\/projects\/(\d+)\/tasks\/(\d+)\/assignments$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const project = accessibleProject(db, ctx.ids[0], user);
    requireOwnerOrAdmin(project, user, 'Only project owners can manage assignments');
    const task = findTask(db, project.id, ctx.ids[1]);
    const assigneeId = Number(ctx.body.user_id);
    if (!isMember(db, project.id, assigneeId)) forbidden('User must be a project member to be assigned', 'not_a_member');
    if (db.assignments.some((a) => a.task_id === task.id && a.user_id === assigneeId)) {
      fail(409, 'duplicate_assignment', 'User already assigned to this task');
    }
    const row = assign(db, task.id, assigneeId, user.id);
    return [201, { ...row, assignee: publicUser(findUser(db, assigneeId)) }];
  }],
  ['DELETE', /^\/projects\/(\d+)\/tasks\/(\d+)\/assignments\/(\d+)$/, (db, ctx) => {
    const user = currentUser(db, ctx);
    const [projectId, taskId, assigneeId] = ctx.ids;
    const project = accessibleProject(db, projectId, user);
    requireOwnerOrAdmin(project, user, 'Only project owners can manage assignments');
    const task = findTask(db, project.id, taskId);
    if (!db.assignments.some((a) => a.task_id === task.id && a.user_id === assigneeId)) {
      notFound('Assignment not found');
    }
    db.assignments = db.assignments.filter((a) => !(a.task_id === task.id && a.user_id === assigneeId));
    return [204, null];
  }],
];

// ─── Axios adapter ────────────────────────────────────────────────────────────

export async function demoAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  // Small delay so loading states look like a real network
  await new Promise((resolve) => setTimeout(resolve, 120));

  const method = (config.method ?? 'get').toUpperCase();
  const path = (config.url ?? '').replace(/^.*\/api\/v1/, '').split('?')[0];
  const rawBody: unknown = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : config.data;
  const ctx: Ctx = {
    ids: [],
    body: (rawBody ?? {}) as Record<string, unknown>,
    query: config.params ?? {},
    token: config.headers?.Authorization ? String(config.headers.Authorization) : null,
  };

  const db = loadDb();
  let status = 500;
  let data: unknown = null;
  try {
    const route = routes.find(([m, pattern]) => m === method && pattern.test(path));
    if (!route) notFound('Not found');
    ctx.ids = (route[1].exec(path) ?? []).slice(1).map(Number);
    [status, data] = route[2](db, ctx);
    saveDb(db);
  } catch (err) {
    const failure = err as Partial<Failure> | null;
    if (typeof failure?.status !== 'number') throw err;
    status = failure.status;
    data = { error: { code: failure.code, message: failure.message, details: null } };
  }

  const response: AxiosResponse = {
    data: status === 204 ? '' : data,
    status,
    statusText: String(status),
    headers: {},
    config,
    request: {},
  };
  if (status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response
    );
  }
  return response;
}
