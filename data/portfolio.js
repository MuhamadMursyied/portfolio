// Portfolio content. Edit it with editor.html, or by hand: everything after
// "window.PORTFOLIO = " must stay valid JSON.
window.PORTFOLIO = {
  "site": {
    "title": "Muhamad Mursyied · Robotics Engineer",
    "description": "Mechatronics engineer building software for unmanned ground vehicles with ROS 2.",
    "theme": "midnight",
    "allowThemeSwitch": true,
    "showSkillLevels": false,
    "sections": ["about", "focus", "skills", "experience", "projects", "education", "contact"],
    "sourceUrl": "https://github.com/MuhamadMursyied/portfolio",
    "publish": { "owner": "MuhamadMursyied", "repo": "portfolio", "branch": "main" }
  },
  "profile": {
    "name": "Muhamad Mursyied",
    "headline": "Mechatronics Engineer · Robotics & UGV",
    "tagline": "I build the software that lets unmanned ground vehicles sense, plan and move, using **ROS 2 Jazzy** on Ubuntu, from simulation through to real hardware.",
    "status": "Working full time in robotics",
    "location": "Malaysia",
    "email": "",
    "avatar": "",
    "resume": "",
    "contactNote": "Interested in robotics, autonomous vehicles or a collaboration? I am happy to talk.",
    "links": [
      { "label": "GitHub", "url": "https://github.com/MuhamadMursyied" }
    ]
  },
  "about": "I am a mechatronics engineering graduate now working full time, and robotics is where my interest lies. My main focus is **unmanned ground vehicles (UGVs)**: getting a robot to know where it is, map its surroundings and drive itself safely from A to B.\n\nMost of my work is in **ROS 2 Jazzy** on Ubuntu 24.04, written in Python for quick prototyping and C++ where performance matters. I deploy on onboard computers such as the Intel NUC and NVIDIA Jetson, which means caring about the whole system: sensors, drivers, compute limits and the mechanical platform underneath.\n\nLooking ahead, I want to take what I have learned on the ground into the air and onto the water, with **UAVs** and **USVs**.",
  "focus": [
    {
      "title": "Unmanned Ground Vehicles",
      "stage": "now",
      "icon": "ugv",
      "description": "Autonomous navigation for ground robots: localisation, mapping, path planning and sensor integration with ROS 2.",
      "topics": ["ROS 2 Jazzy", "Nav2", "SLAM", "LiDAR", "Sensor fusion"]
    },
    {
      "title": "Unmanned Aerial Vehicles",
      "stage": "next",
      "icon": "uav",
      "description": "Bringing ROS 2 skills to drones: flight controller integration, state estimation and aerial mapping.",
      "topics": ["PX4", "ArduPilot", "MAVROS", "Aerial mapping"]
    },
    {
      "title": "Unmanned Surface Vehicles",
      "stage": "future",
      "icon": "usv",
      "description": "Autonomy on the water: marine navigation, GNSS-based guidance and operating in harsh outdoor conditions.",
      "topics": ["Marine autonomy", "GNSS / RTK", "Field robotics"]
    }
  ],
  "skills": [
    {
      "group": "Robotics",
      "items": [
        { "name": "ROS 2 (Jazzy)", "level": 4 },
        { "name": "Nav2", "level": 3 },
        { "name": "SLAM", "level": 3 },
        { "name": "Gazebo simulation", "level": 3 },
        { "name": "URDF & TF2", "level": 3 },
        { "name": "LiDAR / IMU / camera integration", "level": 3 }
      ]
    },
    {
      "group": "Programming",
      "items": [
        { "name": "Python", "level": 4 },
        { "name": "C++", "level": 3 },
        { "name": "Bash", "level": 3 },
        { "name": "JavaScript", "level": 3 }
      ]
    },
    {
      "group": "Platforms & tools",
      "items": [
        { "name": "Ubuntu 24.04", "level": 4 },
        { "name": "Git & GitHub", "level": 4 },
        { "name": "NVIDIA Jetson", "level": 3 },
        { "name": "Intel NUC", "level": 3 },
        { "name": "Docker", "level": 3 }
      ]
    },
    {
      "group": "Mechatronics",
      "items": [
        { "name": "Embedded systems", "level": 3 },
        { "name": "Control systems", "level": 3 },
        { "name": "Electronics", "level": 3 },
        { "name": "CAD", "level": 3 }
      ]
    }
  ],
  "experience": [
    {
      "role": "Robotics Engineer",
      "org": "",
      "orgUrl": "",
      "type": "Full time",
      "location": "Malaysia",
      "start": "",
      "end": "",
      "current": true,
      "summary": "Developing ROS 2 Jazzy software for unmanned ground vehicles on Ubuntu 24.04, running on onboard computers such as the Intel NUC and NVIDIA Jetson.",
      "highlights": [],
      "tags": ["ROS 2", "UGV", "Python", "C++"]
    }
  ],
  "projects": [
    {
      "id": "ugv-navigation",
      "title": "UGV autonomous navigation",
      "summary": "Write a one-line summary of your UGV work here.",
      "description": "This entry is hidden from the live site until you untick Hidden in the editor.\n\nDescribe the problem, your role, the stack and the result. Add photos of the robot, a screen recording of RViz, or a YouTube link to a test run.",
      "tags": ["ROS 2", "UGV", "Nav2"],
      "date": "",
      "role": "",
      "featured": true,
      "hidden": true,
      "icon": "ugv",
      "links": [],
      "media": []
    },
    {
      "id": "cv-builder",
      "title": "CV Builder",
      "summary": "A browser tool that turns your details into an ATS-friendly CV for the Malaysian job market, with three career tiers and ten themes.",
      "description": "Pick your career level, choose one of ten themes and download a CV that applicant tracking systems can read. Everything runs in the browser, so no data leaves your machine.\n\n- Three career tiers (student, mid-career, senior), each with its own section order and guidance\n- Ten ATS-safe themes; exports to text-based PDF, Word (.docx) and plain text\n- ATS score with fixes, plus a job-ad keyword match\n- Malaysian conventions built in: +60 phone, CGPA and MUET, PDPA reminders\n\nBuilt with plain HTML, CSS and JavaScript. The Word file is written by hand with no libraries, and one layout engine drives both the live preview and the PDF.",
      "tags": ["Web app", "JavaScript", "Tools"],
      "date": "2026-10",
      "role": "Solo project",
      "featured": false,
      "hidden": false,
      "links": [
        { "label": "Live demo", "url": "https://muhamadmursyied.github.io/cv-builder/" },
        { "label": "Source code", "url": "https://github.com/MuhamadMursyied/cv-builder" }
      ],
      "media": [
        { "type": "image", "src": "media/cv-builder-editor.webp", "caption": "Editor with the live A4 preview" },
        { "type": "image", "src": "media/cv-builder-ats-check.webp", "caption": "ATS check and job-ad keyword match" }
      ]
    },
    {
      "id": "kedai-pos",
      "title": "Kedai POS",
      "summary": "A complete point-of-sale system for small Malaysian shops that runs in the browser and works offline, with SST, cash rounding and receipts.",
      "description": "A full point-of-sale app for a small shop, installable as a PWA and usable offline.\n\n- Checkout with barcode scanning, discounts, held sales and keyboard shortcuts\n- Cash, card, DuitNow QR and e-wallet, split payments and 5 sen cash rounding\n- Malaysian SST (tax-inclusive or exclusive), 80 mm receipts, full or partial refunds\n- Shifts with a cash-drawer count, inventory, customers, staff roles and reports\n- Light and dark modes, works on desktop, tablet and phone\n\nPlain HTML, CSS and JavaScript with data kept in the browser. Money maths is covered by unit tests.",
      "tags": ["Web app", "JavaScript", "PWA"],
      "date": "2026-10",
      "role": "Solo project",
      "featured": false,
      "hidden": false,
      "links": [
        { "label": "Live demo", "url": "https://muhamadmursyied.github.io/pos-system/" },
        { "label": "Source code", "url": "https://github.com/MuhamadMursyied/pos-system" }
      ],
      "media": [
        { "type": "image", "src": "media/pos-checkout.webp", "caption": "Checkout screen" },
        { "type": "image", "src": "media/pos-receipt.webp", "caption": "Receipt with SST summary" },
        { "type": "image", "src": "media/pos-reports.webp", "caption": "Sales reports" },
        { "type": "image", "src": "media/pos-mobile-dark.webp", "caption": "Phone layout in dark mode" }
      ]
    }
  ],
  "education": [
    {
      "qualification": "Mechatronics Engineering",
      "school": "",
      "location": "",
      "start": "",
      "end": "",
      "grade": "",
      "details": []
    }
  ],
  "certifications": []
};
