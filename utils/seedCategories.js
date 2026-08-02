const GroupCategory = require('../models/GroupCategory');

const defaultCategories = [
  { code: 'study', name: 'Study Group', icon: '📚', description: 'Students discuss subjects, assignments, exams and notes.' },
  { code: 'projects', name: 'Project Team', icon: '💻', description: 'Students build academic or personal projects together.' },
  { code: 'hackathons', name: 'Hackathon Team', icon: '🏆', description: 'Students find teammates and collaborate for hackathons.' },
  { code: 'internships', name: 'Internship Discussion', icon: '💼', description: 'Students discuss internships, referrals, interview experiences and opportunities.' },
  { code: 'college', name: 'College Batch', icon: '🎓', description: 'Groups for specific colleges, branches, years or semesters.' },
  { code: 'subjects', name: 'Subject Group', icon: '📖', description: 'Dedicated groups for academic subjects.' },
  { code: 'placements', name: 'Placement Preparation', icon: '🎯', description: 'Interview preparation, aptitude, coding rounds, HR discussions and company-specific preparation.' },
  { code: 'coding', name: 'Coding Club', icon: '👨💻', description: 'Programming discussions, coding contests, open-source projects and competitive programming.' }
];

const seedCategories = async () => {
  try {
    for (const cat of defaultCategories) {
      const exists = await GroupCategory.findOne({ code: cat.code });
      if (!exists) {
        await GroupCategory.create(cat);
        console.log(`🌱 Seeded Group Category: ${cat.name}`);
      }
    }
  } catch (err) {
    console.error('❌ Group Category Seeding Error:', err);
  }
};

module.exports = seedCategories;
