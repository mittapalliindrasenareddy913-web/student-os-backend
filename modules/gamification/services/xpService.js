/**
 * User Gamification Experience (XP) & Levels Progression Engine.
 */
const User = require('../../../models/User');
const { logger } = require('../../../shared/logging/logger');

const XP_ACTIONS = {
  CREATE_POST: 10,
  CREATE_COMMENT: 5,
  LIKE_POST: 1,
  RSVP_EVENT: 2
};

class XPService {
  /**
   * Calculates level based on experience points (XP).
   */
  calculateLevel(xp) {
    if (xp < 100) return 1;
    if (xp < 300) return 2;
    if (xp < 600) return 3;
    // Level scales up continuously
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  /**
   * Adds XP to a user profile and increments level if threshold is crossed.
   */
  async grantXP(userId, action, session = null) {
    try {
      const xpAmount = XP_ACTIONS[action] || 1;
      const user = await User.findById(userId).session(session);
      if (!user) return null;

      // Ensure gamification fields exist on schema
      const oldXP = user.experiencePoints || 0;
      const newXP = oldXP + xpAmount;
      const oldLevel = user.level || 1;
      const newLevel = this.calculateLevel(newXP);

      const updateData = {
        experiencePoints: newXP,
        level: newLevel
      };

      // Trigger automatic badge award
      if (newLevel > oldLevel) {
        logger.info('User level up achieved', { userId, oldLevel, newLevel });
        // Award badge based on level milestones
        const currentBadges = user.badges || [];
        const badgeName = `Level ${newLevel} Achiever`;
        if (!currentBadges.includes(badgeName)) {
          updateData.$addToSet = { badges: badgeName };
        }
      }

      await User.findByIdAndUpdate(userId, updateData, { session });
      return { xpAdded: xpAmount, totalXP: newXP, level: newLevel };
    } catch (err) {
      logger.warn('Failed to grant XP to user', { userId, action, error: err.message });
      return null;
    }
  }
}

module.exports = new XPService();
