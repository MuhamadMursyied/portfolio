// Unit tests for the CV reader. Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const CV = require('../js/cv-import.js');

test('dates in common CV formats become YYYY-MM', () => {
  assert.strictEqual(CV.toYearMonth('Mar 2025'), '2025-03');
  assert.strictEqual(CV.toYearMonth('September 2021'), '2021-09');
  assert.strictEqual(CV.toYearMonth('Ogos 2022'), '2022-08');
  assert.strictEqual(CV.toYearMonth('03/2024'), '2024-03');
  assert.strictEqual(CV.toYearMonth('2019'), '2019');
  const r = CV.findRange('Robotics Engineer   Jul 2025 – Present');
  assert.deepStrictEqual([r.start, r.end, r.current, r.rest], ['2025-07', '', true, 'Robotics Engineer']);
  assert.strictEqual(CV.findRange('Worked on ROS 2 nodes'), null);
});

test('a CV with dates first, pipes and a different layout still parses', () => {
  const text = [
    'MUHAMAD MURSYIED',
    'Robotics Engineer',
    'Shah Alam, Selangor',
    'murs@example.com · +60 12-345 6789 · github.com/MuhamadMursyied',
    '',
    'CAREER OBJECTIVE',
    'Engineer focused on autonomous ground robots.',
    '',
    'WORKING EXPERIENCE',
    'Robotics Engineer | Example Robotics Sdn Bhd',
    '08/2025 - Present',
    '- Built a Nav2 stack for an outdoor UGV running on a Jetson Orin',
    '- Tuned the EKF that fuses wheel odometry, IMU and',
    '  RTK GNSS',
    'Intern | Another Co',
    'Jan 2025 to Jun 2025',
    '- Wrote ROS 2 drivers in C++',
    '',
    'EDUCATION',
    'Bachelor of Engineering (Mechatronics), 2025',
    'Universiti Example',
    'CGPA 3.50',
    '',
    'TECHNICAL SKILLS',
    'ROS 2, Nav2, Python, C++',
    '',
    'CERTIFICATIONS',
    '• ROS 2 Developer – The Construct, 2024',
    '',
    'REFERENCES',
    'Available on request',
  ].join('\n');
  const r = CV.parseCvText(text);
  assert.strictEqual(r.profile.name, 'MUHAMAD MURSYIED');
  assert.strictEqual(r.profile.headline, 'Robotics Engineer');
  assert.strictEqual(r.profile.email, 'murs@example.com');
  assert.strictEqual(r.profile.location, 'Shah Alam, Selangor');
  assert.deepStrictEqual(r.profile.links, [{ label: 'GitHub', url: 'https://github.com/MuhamadMursyied' }]);
  assert.strictEqual(r.about, 'Engineer focused on autonomous ground robots.');

  assert.strictEqual(r.experience.length, 2);
  const [job, intern] = r.experience;
  assert.deepStrictEqual([job.role, job.org, job.start, job.current], ['Robotics Engineer', 'Example Robotics Sdn Bhd', '2025-08', true]);
  assert.deepStrictEqual(job.highlights, ['Built a Nav2 stack for an outdoor UGV running on a Jetson Orin', 'Tuned the EKF that fuses wheel odometry, IMU and RTK GNSS']);
  assert.deepStrictEqual([intern.role, intern.org, intern.start, intern.end], ['Intern', 'Another Co', '2025-01', '2025-06']);

  assert.deepStrictEqual([r.education[0].qualification, r.education[0].school, r.education[0].end, r.education[0].grade],
    ['Bachelor of Engineering (Mechatronics)', 'Universiti Example', '2025', 'CGPA 3.50']);
  assert.deepStrictEqual(r.skills, [{ group: 'Skills', items: [{ name: 'ROS 2' }, { name: 'Nav2' }, { name: 'Python' }, { name: 'C++' }] }]);
  assert.deepStrictEqual(r.certifications, [{ name: 'ROS 2 Developer', issuer: 'The Construct', date: '2024', url: '' }]);
});

test('a CV Builder save file maps field by field', () => {
  const r = CV.fromCvBuilder({
    personal: { fullName: 'A', headline: 'H', email: 'a@b.c', location: 'KL', linkedin: 'linkedin.com/in/a', website: '' },
    summary: 'S',
    experience: [{ title: 'T', org: 'O', location: 'L', start: '2024-01', end: 'present', bullets: 'x\ny' }],
    education: [{ qualification: 'Q', institution: 'I', start: '2020-09', end: '2024-07', grade: 'G', bullets: '' }],
    skills: [{ category: 'C', items: 'p, q' }],
    projects: [{ name: 'P', role: 'R', link: 'github.com/a/p', start: '2024-02', end: '', bullets: 'b1' }],
  });
  assert.deepStrictEqual(r.profile.links, [{ label: 'LinkedIn', url: 'https://linkedin.com/in/a' }]);
  assert.deepStrictEqual([r.experience[0].role, r.experience[0].current, r.experience[0].highlights], ['T', true, ['x', 'y']]);
  assert.strictEqual(r.education[0].school, 'I');
  assert.deepStrictEqual(r.skills[0].items, [{ name: 'p' }, { name: 'q' }]);
  assert.deepStrictEqual(r.projects[0].links, [{ label: 'Source code', url: 'https://github.com/a/p' }]);
});
