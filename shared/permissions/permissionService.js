/**
 * Role Permission Engine
 * Defines action mappings for system roles.
 */
const ROLE_PERMISSIONS = {
  student: [
    'posts:create', 'posts:read', 'posts:update', 'posts:delete', 'posts:like', 'posts:report',
    'comments:create', 'comments:delete', 'comments:update',
    'clubs:join', 'clubs:read', 'clubs:create',
    'events:rsvp', 'events:read',
    'media:upload',
    'analytics:read_self'
  ],
  faculty: [
    'posts:create', 'posts:read', 'posts:update', 'posts:delete', 'posts:like',
    'comments:create', 'comments:delete',
    'clubs:read',
    'events:create', 'events:read',
    'media:upload',
    'analytics:read_self'
  ],
  hod: [
    'posts:create', 'posts:read', 'posts:update', 'posts:delete',
    'announcements:create', 'announcements:read',
    'sections:manage', 'faculty:view',
    'analytics:read_department',
    'media:upload'
  ],
  principal: [
    'posts:create', 'posts:read', 'posts:update', 'posts:delete',
    'announcements:create', 'announcements:read',
    'faculty:manage', 'hod:manage',
    'clubs:approve', 'events:approve',
    'passwords:reset',
    'analytics:read_college',
    'college:manage'
  ],
  coe: [
    'exams:manage', 'timetables:manage', 'halltickets:manage',
    'analytics:read_college'
  ],
  admin: [
    'college:manage', 'users:manage', 'analytics:read_college', 'logs:read_college'
  ],
  'super-admin': [
    'colleges:create', 'colleges:read', 'colleges:update', 'colleges:delete',
    'system:read_logs', 'system:read_metrics', 'system:manage'
  ]
};

const hasPermission = (userRole, action) => {
  if (!userRole) return false;
  // Super Admin can do everything
  if (userRole === 'super-admin') return true;
  
  const allowedActions = ROLE_PERMISSIONS[userRole];
  return allowedActions ? allowedActions.includes(action) : false;
};

module.exports = {
  hasPermission,
  ROLE_PERMISSIONS
};
