/**
 * Decoupled Enterprise Audit Logging Service.
 * Logs to Winston audit transporter AND writes to the database.
 */
const AuditLog = require('../../models/AuditLog');
const { auditLogger } = require('./logger');

const parseUserAgent = (userAgentString) => {
  const ua = userAgentString || 'Unknown';
  let platform = 'Unknown';
  let browser = 'Unknown';
  let device = 'Desktop';

  if (/mobile/i.test(ua)) device = 'Mobile';
  if (/tablet/i.test(ua)) device = 'Tablet';

  if (/windows/i.test(ua)) platform = 'Windows';
  else if (/macintosh/i.test(ua)) platform = 'macOS';
  else if (/linux/i.test(ua)) platform = 'Linux';
  else if (/android/i.test(ua)) platform = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) platform = 'iOS';

  if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/msie|trident/i.test(ua)) browser = 'Internet Explorer';
  else if (/edg/i.test(ua)) browser = 'Edge';

  return { platform, browser, device };
};

const writeAuditLog = async (req, { action, actorId, actorRole, collegeCode, department, targetId, oldValues = null, newValues = null }) => {
  try {
    const userAgentRaw = req ? req.headers['user-agent'] || '' : '';
    const ipAddress = req ? req.ip || req.connection.remoteAddress || '127.0.0.1' : '127.0.0.1';
    const requestId = req ? req.reqId || '' : '';

    const { platform, browser, device } = parseUserAgent(userAgentRaw);

    // 1. Write to database log model
    await AuditLog.create({
      userId: actorId || null,
      role: actorRole || 'system',
      collegeCode: collegeCode || '',
      department: department || '',
      action,
      device: `${device} (${platform})`,
      ipAddress,
      oldValues,
      newValues
    });

    // 2. Stream to structured daily-rotate audit log file
    auditLogger.info('Action Audited', {
      action,
      requestId,
      ipAddress,
      platform,
      browser,
      device,
      actor: { id: actorId, role: actorRole, collegeCode },
      target: targetId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('AuditLog creation failure:', err.message);
  }
};

module.exports = {
  writeAuditLog
};
