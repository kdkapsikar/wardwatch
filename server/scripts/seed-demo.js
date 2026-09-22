// Bulk demo data for screen recordings (e.g. the Marathi explainer video) - NOT for real use.
//   npm run seed:demo                  (500 issues)
//   SEED_COUNT=200 npm run seed:demo   (a different count)
//
// Generates realistic-looking issues spread across every category, every constituency and every
// status, with descriptions randomly in English or Marathi (so dashboards, lists and the pie chart
// look properly populated and bilingual on camera) - so dashboards, lists and charts look properly
// populated on camera instead of empty or filled with 3 identical rows.
//
// Safety:
//  - Refuses in production (same guard as scripts/seed.js) and additionally requires CONFIRM=yes,
//    because 500 rows is a lot more to undo than the handful scripts/seed.js creates.
//  - Prints which database it is about to write to before doing anything.
//  - Every fake citizen phone number comes from one reserved block (9800000001-9800000060) that is
//    never used anywhere else in this codebase, so the whole batch is trivially identifiable and
//    removable afterwards - see the DELETE statements printed at the end of this file's output.
//
// Run scripts/seed.js FIRST (it creates the 29 constituencies, their corporators, and the admin
// account) - this script only adds issues on top of whatever wards/corporators already exist.
import { randomInt } from 'node:crypto';
import { config } from '../src/config.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { deriveTitle } from '../src/lib/title.js';
import { generatePublicId } from '../src/lib/ids.js';

if (config.isProd) {
  console.error('Refusing to create demo issues in production.');
  process.exit(1);
}
if (process.env.CONFIRM !== 'yes') {
  console.error('Set CONFIRM=yes to run this (it writes a lot of fake data - see the file header).');
  process.exit(1);
}

const COUNT = Number(process.env.SEED_COUNT) || 500;
const PHONE_POOL_SIZE = 60; // several issues per phone, so the citizen portal has something to show
const OVERDUE_DAYS_WINDOW = 75; // spreads created_at over ~2.5 months so charts/trends look organic

const pick = (arr) => arr[randomInt(arr.length)];
const rand = (min, max) => min + randomInt(max - min + 1);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

const FIRST_NAMES = [
  'Priya', 'Rohan', 'Meera', 'Asha', 'Arjun', 'Neha', 'Sanjay', 'Pooja', 'Vikram', 'Kavita',
  'Suresh', 'Anita', 'Ganesh', 'Snehal', 'Prakash', 'Madhuri', 'Ramesh', 'Sunita', 'Nitin', 'Vaishali',
  'Amol', 'Rupali', 'Sachin', 'Manisha', 'Vijay', 'Shubhangi', 'Dinesh', 'Kalpana', 'Mahesh', 'Swati',
];
const LAST_NAMES = [
  'Sharma', 'Deshmukh', 'Iyer', 'Patil', 'Nair', 'Verma', 'Joshi', 'Kulkarni', 'Pawar', 'More',
  'Jadhav', 'Shinde', 'Gaikwad', 'Bhosale', 'Chavan', 'Wagh', 'Kale', 'Salunkhe', 'Thakur', 'Rane',
];

// area/{days} are filled in per-row from the assigned constituency and a random day count.
const TEMPLATES = {
  roads: {
    en: [
      'Large pothole on the main road near {area}, causing trouble for two-wheelers.',
      'Road surface near {area} has broken down badly after the rains.',
      'Speed breaker near {area} is damaged and needs urgent repair.',
      'Footpath near {area} is broken and unsafe for pedestrians.',
    ],
    mr: [
      '{area} जवळील मुख्य रस्त्यावर मोठा खड्डा पडला असून दुचाकीस्वारांना त्रास होत आहे.',
      'पावसामुळे {area} जवळील रस्त्याची अवस्था खूप खराब झाली आहे.',
      '{area} जवळील स्पीड ब्रेकर तुटलेला असून त्वरित दुरुस्तीची गरज आहे.',
      '{area} जवळील पदपथ तुटलेला असून पादचाऱ्यांसाठी धोकादायक आहे.',
    ],
  },
  water: {
    en: [
      'No water supply in {area} for the last {days} days.',
      'Low water pressure in {area}; taps run dry by mid-morning.',
      'A water pipeline near {area} is leaking and wasting a lot of water.',
      'Tanker water has not arrived in {area} for {days} days.',
    ],
    mr: [
      '{area} भागात गेल्या {days} दिवसांपासून पाणीपुरवठा झालेला नाही.',
      '{area} भागात पाण्याचा दाब खूप कमी असून सकाळीच नळ कोरडे पडतात.',
      '{area} जवळील पाण्याची पाईपलाईन गळत असून मोठ्या प्रमाणात पाणी वाया जात आहे.',
      '{area} भागात गेल्या {days} दिवसांपासून टँकरचे पाणी आलेले नाही.',
    ],
  },
  sanitation: {
    en: [
      'Garbage has not been collected in {area} for {days} days.',
      'Overflowing dustbin near {area} is causing a bad smell.',
      'Dead animal lying near {area} has not been removed.',
      'Public toilet near {area} is very unclean and needs cleaning.',
    ],
    mr: [
      '{area} भागातील कचरा गेल्या {days} दिवसांपासून उचलला गेलेला नाही.',
      '{area} जवळील कचराकुंडी ओसंडून वाहत असून दुर्गंधी पसरत आहे.',
      '{area} जवळ मृत जनावर पडलेले असून ते हटवलेले नाही.',
      '{area} जवळील सार्वजनिक शौचालय खूप अस्वच्छ असून स्वच्छतेची गरज आहे.',
    ],
  },
  streetlights: {
    en: [
      'Street lights near {area} have been off for {days} days.',
      'A street light pole near {area} is damaged and sparking.',
      'Dark stretch near {area} at night due to non-working lights.',
    ],
    mr: [
      '{area} जवळील पथदिवे गेल्या {days} दिवसांपासून बंद आहेत.',
      '{area} जवळील पथदिव्याचा खांब तुटलेला असून ठिणग्या उडत आहेत.',
      'पथदिवे बंद असल्याने {area} भाग रात्री खूप अंधारात असतो.',
    ],
  },
  drainage: {
    en: [
      'Drain near {area} overflows every time it rains.',
      'Open drain near {area} is a safety hazard for children.',
      'Sewage water is stagnant near {area} for {days} days.',
    ],
    mr: [
      'पाऊस पडला की {area} जवळील गटार तुंबून वाहते.',
      '{area} जवळील उघडे गटार लहान मुलांसाठी धोकादायक आहे.',
      '{area} जवळ गेल्या {days} दिवसांपासून सांडपाणी साचून राहिले आहे.',
    ],
  },
  parks: {
    en: [
      'Swings in the park near {area} are broken.',
      'Park near {area} has overgrown grass and needs maintenance.',
      'Boundary wall of the garden near {area} has collapsed.',
    ],
    mr: [
      '{area} जवळील उद्यानातील झोपाळे तुटलेले आहेत.',
      '{area} जवळील बागेत गवत खूप वाढले असून देखभालीची गरज आहे.',
      '{area} जवळील बागेची संरक्षक भिंत कोसळली आहे.',
    ],
  },
  other: {
    en: [
      'Stray dogs near {area} have become aggressive; residents are worried.',
      'Illegal parking near {area} is blocking the road daily.',
      'Encroachment near {area} is narrowing the footpath.',
    ],
    mr: [
      '{area} भागात भटकी कुत्री आक्रमक झाली असून रहिवासी चिंतेत आहेत.',
      '{area} जवळ रोज बेकायदेशीर पार्किंगमुळे रस्ता अडतो.',
      '{area} जवळील अतिक्रमणामुळे पदपथ अरुंद होत आहे.',
    ],
  },
};
const CATEGORIES = Object.keys(TEMPLATES);

const REMARKS = {
  acknowledged: {
    en: ['We have received your complaint and will act on it soon.', 'Noted - this will be inspected shortly.'],
    mr: ['तुमची तक्रार प्राप्त झाली असून लवकरच कार्यवाही केली जाईल.', 'नोंद घेतली आहे, लवकरच पाहणी केली जाईल.'],
  },
  in_progress: {
    en: ['Work has started and should be completed soon.', 'Team has been dispatched to the location.'],
    mr: ['काम सुरू करण्यात आले असून लवकरच पूर्ण होईल.', 'पथकाला घटनास्थळी पाठवण्यात आले आहे.'],
  },
  resolved: {
    en: ['Issue has been resolved. Thank you for reporting.', 'Fixed by our team after inspection.'],
    mr: ['तक्रारीचे निवारण करण्यात आले आहे. कळवल्याबद्दल धन्यवाद.', 'पाहणी आणि दुरुस्तीनंतर तक्रार निकाली काढण्यात आली आहे.'],
  },
};
const REJECTION_REASONS = {
  en: ["This falls under a different department's jurisdiction.", 'Duplicate of an already resolved complaint.', 'Could not verify the reported issue at the location.'],
  mr: ['हे दुसऱ्या विभागाच्या अखत्यारीत येते.', 'आधीच निकाली काढलेल्या तक्रारीची पुनरावृत्ती आहे.', 'सांगितलेल्या ठिकाणी समस्या आढळून आली नाही.'],
};

// 15% submitted / 15% acknowledged / 20% in_progress / 40% resolved / 10% rejected.
const STATUS_WEIGHTS = [
  ['submitted', 0.15], ['acknowledged', 0.15], ['in_progress', 0.20], ['resolved', 0.40], ['rejected', 0.10],
];
function pickStatus() {
  const r = Math.random();
  let acc = 0;
  for (const [status, weight] of STATUS_WEIGHTS) {
    acc += weight;
    if (r <= acc) return status;
  }
  return 'submitted';
}

/** One area name out of a constituency's comma-separated area list, in the given language. */
function pickArea(ward, lang) {
  const raw = lang === 'mr' ? ward.name_mr : ward.name;
  const parts = (raw || ward.name).split(',').map((s) => s.trim().replace(/^(and|आणि)\s+/i, ''));
  return pick(parts.filter(Boolean));
}

async function main() {
  const dbUrl = new URL(config.databaseUrl);
  console.log(`About to create ${COUNT} demo issues in: ${dbUrl.hostname}${dbUrl.pathname}`);

  const wards = (await query(
    `SELECT w.id, w.number, w.name, w.name_mr, c.id AS corporator_id
       FROM wards w LEFT JOIN corporators c ON c.ward_id = w.id AND c.is_active = true
      ORDER BY w.number`,
  )).rows;
  if (wards.length === 0) {
    console.error('No constituencies found - run `npm run seed` first.');
    process.exit(1);
  }

  const phones = Array.from({ length: PHONE_POOL_SIZE }, (_, i) => `9800${String(i + 1).padStart(6, '0')}`);
  const counts = { category: {}, status: {}, lang: { en: 0, mr: 0 } };

  await withTransaction(async (db) => {
    for (let i = 0; i < COUNT; i += 1) {
      const ward = pick(wards);
      const category = pick(CATEGORIES);
      const lang = Math.random() < 0.5 ? 'en' : 'mr';
      const area = pickArea(ward, lang);
      const days = rand(2, 15);
      const description = pick(TEMPLATES[category][lang]).replace('{area}', area).replace('{days}', days);
      const title = deriveTitle(description);
      const address = Math.random() < 0.6 ? (lang === 'mr' ? `${area} जवळ` : `Near ${area}`) : null;
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const phone = pick(phones);
      const status = pickStatus();
      const createdAt = daysAgo(rand(0, OVERDUE_DAYS_WINDOW));
      // Nashik-area coordinates (matches the demo constituencies), scattered per issue.
      const latitude = 19.9975 + (Math.random() - 0.5) * 0.1;
      const longitude = 73.7898 + (Math.random() - 0.5) * 0.1;

      let issue;
      for (let attempt = 0; attempt < 5 && !issue; attempt += 1) {
        const result = await db.query(
          `INSERT INTO issues
             (public_id, ward_id, corporator_id, category, title, description, address,
              citizen_name, citizen_phone, photos, latitude, longitude, status, consent_at,
              created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'{}',$10,$11,$12,$13,$13,$13)
           ON CONFLICT (public_id) DO NOTHING
           RETURNING id`,
          [generatePublicId(), ward.id, ward.corporator_id, category, title, description, address,
           name, phone, latitude, longitude, status, createdAt],
        );
        issue = result.rows[0];
      }
      if (!issue) throw new Error('Could not allocate a unique issue ID');

      // First history row: always "submitted", filed by the citizen (corporator_id NULL).
      await db.query(
        `INSERT INTO issue_updates (issue_id, status, remark, created_at) VALUES ($1, 'submitted', $2, $3)`,
        [issue.id, lang === 'mr' ? 'तक्रार प्राप्त झाली' : 'Issue received', createdAt],
      );

      if (status !== 'submitted') {
        const actedAt = new Date(Math.min(Date.now(), createdAt.getTime() + rand(1, 12) * 86_400_000));
        const rejectionReason = status === 'rejected' ? pick(REJECTION_REASONS[lang]) : null;
        const remark = status === 'rejected' ? null : pick(REMARKS[status][lang]);
        const resolvedAt = status === 'resolved' ? actedAt : null;
        await db.query(
          `INSERT INTO issue_updates (issue_id, corporator_id, status, remark, rejection_reason, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [issue.id, ward.corporator_id, status, remark, rejectionReason, actedAt],
        );
        await db.query('UPDATE issues SET updated_at = $2, resolved_at = $3 WHERE id = $1', [issue.id, actedAt, resolvedAt]);
      }

      counts.category[category] = (counts.category[category] || 0) + 1;
      counts.status[status] = (counts.status[status] || 0) + 1;
      counts.lang[lang] += 1;
    }
  });

  console.log(`\nCreated ${COUNT} demo issues.`);
  console.log('By category:', counts.category);
  console.log('By status:  ', counts.status);
  console.log('By language:', counts.lang);
  console.log(`\nDemo citizen phones used: 9800000001-9800${String(PHONE_POOL_SIZE).padStart(6, '0')}`);
  console.log('Sign in to the citizen portal with any of those numbers (OTP 1111) to see a populated "My complaints" list.');
  console.log('\nTo remove all of this afterwards:');
  console.log("  DELETE FROM issue_updates WHERE issue_id IN (SELECT id FROM issues WHERE citizen_phone LIKE '9800%');");
  console.log("  DELETE FROM issues WHERE citizen_phone LIKE '9800%';");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
