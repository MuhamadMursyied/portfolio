// Editor-only: reads a CV (PDF, Word .docx, plain text, or a CV Builder .json save)
// and turns it into portfolio fields. The editor shows the result for review before
// anything is changed. Parsing is heuristic: it looks for the usual section headings
// ("Experience", "Education", "Skills"...) and date ranges ("Mar 2024 – Present").
// The parsing functions are plain and also run in Node for the unit tests.
(function (root) {
  'use strict';

  // ---------- dates ----------

  const MONTHS = {
    jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3, march: 3, mac: 3,
    apr: 4, april: 4, may: 5, mei: 5, jun: 6, june: 6, jul: 7, july: 7, julai: 7,
    aug: 8, august: 8, ogos: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, okt: 10, oktober: 10,
    nov: 11, november: 11, dec: 12, december: 12, dis: 12, disember: 12,
  };
  const MONTH_RE = '(?:' + Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|') + ')';
  const DATE_RE = '(?:' + MONTH_RE + '\\.?\\s+\\d{4}|\\d{1,2}\\s*[/.-]\\s*\\d{4}|(?:19|20)\\d{2})';
  const END_RE = '(?:' + DATE_RE + '|present|current|now|ongoing|today|sekarang|kini)';
  const RANGE = new RegExp('(' + DATE_RE + ')\\s*(?:–|—|-|to|until|till|hingga)\\s*(' + END_RE + ')', 'i');
  const SINGLE_DATE_AT_END = new RegExp('(?:^|[\\s,(|–—-])(' + DATE_RE + ')\\)?\\s*$', 'i');
  const CURRENT_RE = /^(present|current|now|ongoing|today|sekarang|kini)$/i;

  // "Mar 2025" -> "2025-03", "03/2025" -> "2025-03", "2025" -> "2025".
  function toYearMonth(text) {
    const t = String(text || '').trim().toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ');
    let m = /^([a-z]+) (\d{4})$/.exec(t);
    if (m && MONTHS[m[1]]) return m[2] + '-' + String(MONTHS[m[1]]).padStart(2, '0');
    m = /^(\d{1,2})\s*[/-]\s*(\d{4})$/.exec(t) || /^(\d{1,2}) (\d{4})$/.exec(t);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return m[2] + '-' + m[1].padStart(2, '0');
    m = /^(\d{4})$/.exec(t);
    return m ? m[1] : '';
  }

  // Finds a date range in a line. Returns { start, end, current, rest } or null.
  function findRange(line) {
    const m = RANGE.exec(line);
    if (!m) return null;
    const current = CURRENT_RE.test(m[2].trim());
    return {
      start: toYearMonth(m[1]),
      end: current ? '' : toYearMonth(m[2]),
      current,
      rest: cleanEdges(line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)),
    };
  }

  function findSingleDate(line) {
    const m = SINGLE_DATE_AT_END.exec(line);
    if (!m) return null;
    return { date: toYearMonth(m[1]), rest: cleanEdges(line.slice(0, m.index + m[0].indexOf(m[1]))) };
  }

  // Trim spaces and leftover separators such as "|", "–", "," or "()".
  function cleanEdges(text) {
    return String(text).replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').replace(/^[\s|–—\-,:;·•()]+|[\s|–—\-,:;·•(]+$/g, '').trim();
  }

  // ---------- sections ----------

  const SECTION_PATTERNS = [
    ['about', /^(professional |career |personal |executive )?(summary|profile|objective|about( me)?|overview)$/],
    ['experience', /^((relevant|professional|work|working|industry|industrial|internship( and work)?|employment|career) )*(experience|employment|work history|employment history|career history)$/],
    ['education', /^(education|educational background|academic (background|qualifications?)|qualifications?|education and (training|qualifications))$/],
    ['skills', /^((technical|key|core|professional|relevant) )?(skills|competencies|skill set|skills and (tools|technologies|expertise|abilities))$/],
    ['projects', /^((key|selected|personal|academic|relevant|notable|technical) )?projects$/],
    ['certifications', /^(certifications?|certificates|licen[cs]es( and certifications)?|certifications and (licen[cs]es|training|courses)|courses|training|professional development)$/],
    ['other', /^(languages?|referees?|references|co-?curricular( activities)?( and leadership)?|leadership( and activities)?|activities|achievements( and awards)?|awards( and achievements)?|honou?rs( and awards)?|interests|hobbies( and interests)?|volunteer(ing| experience| work)?|publications|additional information|additional|personal (details|information|particulars)|extra-?curricular( activities)?)$/],
  ];

  function headingOf(line) {
    if (line.length > 48 || /\d/.test(line)) return null;
    const key = line.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    const hit = SECTION_PATTERNS.find(([, re]) => re.test(key));
    return hit ? hit[0] : null;
  }

  const BULLET = /^\s*[•\-*▪●◦‣·○■□➢►✓–]\s*/;
  const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
  const PHONE = /(\+?\d[\d\s-]{7,}\d)/;
  const URL_LIKE = /\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|youtube\.com|[\w-]+\.github\.io)[^\s|,]*)/gi;

  function withScheme(url) {
    return /^https?:\/\//i.test(url) ? url : 'https://' + url.replace(/^\/+/, '');
  }

  function linkLabel(url) {
    if (/linkedin\.com/i.test(url)) return 'LinkedIn';
    if (/github\.com/i.test(url)) return 'GitHub';
    if (/gitlab\.com/i.test(url)) return 'GitLab';
    if (/youtube\.com/i.test(url)) return 'YouTube';
    return 'Website';
  }

  // ---------- header (name, headline, contact) ----------

  function parseHeader(lines) {
    const profile = { name: '', headline: '', email: '', location: '', links: [] };
    const text = lines.join('\n');
    const email = EMAIL.exec(text);
    if (email) profile.email = email[0];
    const seen = new Set();
    (text.match(URL_LIKE) || []).forEach((raw) => {
      const url = withScheme(raw.replace(/[.)]+$/, ''));
      if (seen.has(url.toLowerCase())) return;
      seen.add(url.toLowerCase());
      profile.links.push({ label: linkLabel(url), url });
    });

    const isContact = (l) => EMAIL.test(l) || PHONE.test(l) || /linkedin|github|https?:|www\./i.test(l);
    for (const line of lines) {
      if (isContact(line)) {
        // "Phone | email | City, State | linkedin" - the part with none of those is the location.
        if (!profile.location && /[|•·]/.test(line)) {
          const part = line.split(/\s*[|•·]\s*/).map((s) => s.trim())
            .find((s) => s && !EMAIL.test(s) && !PHONE.test(s) && !/[/@]|\.com|www\./i.test(s) && /[a-z]/i.test(s));
          if (part) profile.location = part;
        }
        continue;
      }
      const words = line.split(/\s+/).length;
      if (!profile.name) {
        if (words <= 6 && /[a-z]/i.test(line) && !/\d/.test(line)) profile.name = line.replace(/\s+/g, ' ');
      } else if (!profile.headline && words <= 14) {
        profile.headline = line;
      } else if (!profile.location && /^[A-Z][\w\s.'-]+,\s*[A-Z][\w\s.'-]+$/.test(line) && words <= 6) {
        profile.location = line;
      }
    }
    return profile;
  }

  // ---------- dated entries (experience, education, projects) ----------

  // Groups lines into entries. A line with a date range starts an entry; bullets
  // belong to the current entry; wrapped bullet lines are joined back together.
  function parseEntries(lines) {
    const entries = [];
    let cur = null;
    let lastBullet = false;
    const start = (title, range) => {
      cur = { title: title || '', start: range ? range.start : '', end: range ? range.end : '', current: !!(range && range.current), hasDate: !!range, sub: [], bullets: [] };
      entries.push(cur);
      lastBullet = false;
    };

    lines.forEach((raw, i) => {
      const line = raw.trim();
      const next = (lines[i + 1] || '').trim();
      if (!line) return;
      const isBullet = BULLET.test(line);
      const range = isBullet ? null : findRange(line);

      if (range) {
        if (!range.rest && cur && !cur.hasDate && !cur.bullets.length) {
          Object.assign(cur, { start: range.start, end: range.end, current: range.current, hasDate: true }); // date on its own line, after the title
        } else {
          start(range.rest, range);
        }
        return;
      }
      if (isBullet) {
        if (!cur) start('', null);
        cur.bullets.push(line.replace(BULLET, '').trim());
        lastBullet = true;
        return;
      }
      if (!cur) { start(line, null); return; }
      if (!cur.title) { cur.title = line; return; }
      // A wrapped bullet line, unless the next line is a bare date (then this is a new title).
      const nextIsDate = !!next && !BULLET.test(next) && (findRange(next) || { rest: 'x' }).rest === '';
      if (lastBullet && !nextIsDate) {
        const prev = cur.bullets[cur.bullets.length - 1];
        if (/^[a-z(]/.test(line) || /^\s/.test(raw) || !/[.!?:]$/.test(prev)) {
          cur.bullets[cur.bullets.length - 1] = prev + ' ' + line;
          return;
        }
      }
      if (cur.bullets.length || cur.sub.length >= 3) { start(line, null); return; }
      cur.sub.push(line);
    });
    return entries.filter((e) => e.title || e.bullets.length);
  }

  // "ABC Sdn. Bhd., Bayan Lepas, Penang" -> ["ABC Sdn. Bhd.", "Bayan Lepas, Penang"]
  function splitOrgLocation(text) {
    const t = String(text || '').trim();
    let m = /^(.+?)\s+[|·•–—]\s+(.+)$/.exec(t);
    if (m) return [m[1], m[2]];
    m = /^(.*?\b(?:Sdn\.?\s*Bhd\.?|Bhd\.?|Berhad|Ltd\.?|Limited|Inc\.?|LLC|Corp\.?|Corporation|PLC|GmbH|Pte\.?\s*Ltd\.?))\s*,?\s*(.*)$/i.exec(t);
    if (m) return [m[1], m[2]];
    const i = t.indexOf(', ');
    return i > 0 ? [t.slice(0, i), t.slice(i + 2)] : [t, ''];
  }

  function toExperience(entry) {
    let role = entry.title;
    let org = '';
    let location = '';
    const sub = entry.sub.slice();
    // "Role | Company" or "Role at Company" on one line.
    const inline = /^(.+?)\s+(?:\||@|at)\s+(.+)$/.exec(role);
    if (inline && !sub.length) { role = inline[1]; [org, location] = splitOrgLocation(inline[2]); }
    else if (sub.length) [org, location] = splitOrgLocation(sub.shift());
    return {
      role, org, orgUrl: '', type: '', location,
      start: entry.start, end: entry.end, current: entry.current,
      summary: sub.join(' '), highlights: entry.bullets, tags: [],
    };
  }

  const GRADE = /\b(c?gpa|cgpa|class|honou?rs|dean|distinction|merit|grade|band|first|second upper|pointer)\b/i;

  function toEducation(entry) {
    const sub = entry.sub.slice();
    let school = '';
    let location = '';
    let grade = '';
    const details = [];
    sub.forEach((line, i) => {
      if (i === 0 && !GRADE.test(line)) [school, location] = splitOrgLocation(line);
      else if (!grade && GRADE.test(line)) grade = line;
      else details.push(line);
    });
    let { start, end } = entry;
    if (!entry.hasDate) {
      const single = findSingleDate(entry.title);
      if (single) { end = single.date; entry.title = single.rest; }
    }
    return { qualification: entry.title, school, location, start, end: entry.current ? '' : end, grade, details: details.concat(entry.bullets) };
  }

  function toProject(entry) {
    const links = [];
    let role = '';
    entry.sub.forEach((line) => line.split(/\s+\|\s+/).forEach((part) => {
      const url = (part.match(URL_LIKE) || [])[0] || (/^(https?:\/\/|www\.)\S+$/i.test(part) ? part : '');
      if (url) links.push({ label: /github|gitlab/i.test(url) ? 'Source code' : 'Link', url: withScheme(url) });
      else if (!role) role = part;
    }));
    return {
      id: '', title: entry.title, summary: entry.bullets[0] || '',
      description: entry.bullets.map((b) => '- ' + b).join('\n'),
      tags: [], date: entry.start, role, featured: false, hidden: false, links, media: [],
    };
  }

  function parseSkills(lines) {
    const groups = [];
    let last = null;
    lines.forEach((raw) => {
      const line = raw.replace(BULLET, '').trim();
      if (!line) return;
      const m = /^([^:]{2,40}):\s*(.+)$/.exec(line);
      const items = (m ? m[2] : line).split(/\s*[,;|•·]\s*/).map((s) => s.trim()).filter(Boolean);
      if (m) { last = { group: m[1].trim(), items: [] }; groups.push(last); }
      else if (!last || !/,$/.test(lines[lines.indexOf(raw) - 1] || '')) {
        last = groups.find((g) => g.group === 'Skills') || null;
        if (!last) { last = { group: 'Skills', items: [] }; groups.push(last); }
      }
      items.forEach((name) => { if (!last.items.some((i) => i.name.toLowerCase() === name.toLowerCase())) last.items.push({ name }); });
    });
    return groups.filter((g) => g.items.length);
  }

  function parseCertifications(lines) {
    return lines.map((raw) => raw.replace(BULLET, '').trim()).filter(Boolean).map((line) => {
      const single = findSingleDate(line);
      const text = single ? single.rest : line;
      const m = /^(.+?)\s+(?:[|–—-]|by)\s+(.+)$/.exec(text) || /^(.+?),\s+(.+)$/.exec(text);
      return { name: m ? m[1] : text, issuer: m ? m[2] : '', date: single ? single.date : '', url: '' };
    });
  }

  // Plain CV text -> portfolio fields. Only keys that were found are returned.
  function parseCvText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\t+/g, '  ').replace(/\s+$/, ''));
    const sections = { header: [] };
    let current = 'header';
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const heading = headingOf(trimmed.replace(/:$/, ''));
      if (heading) { current = heading; sections[current] = sections[current] || []; return; }
      sections[current].push(trimmed);
    });

    const result = { profile: parseHeader(sections.header) };
    if (sections.about) result.about = sections.about.join(' ').replace(/\s+/g, ' ').trim();
    if (sections.experience) result.experience = parseEntries(sections.experience).map(toExperience);
    if (sections.education) result.education = parseEntries(sections.education).map(toEducation);
    if (sections.projects) result.projects = parseEntries(sections.projects).map(toProject);
    if (sections.skills) result.skills = parseSkills(sections.skills);
    if (sections.certifications) result.certifications = parseCertifications(sections.certifications);
    return result;
  }

  // ---------- CV Builder save file ----------

  const lines = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const isPresent = (v) => CURRENT_RE.test(String(v || '').trim());

  function fromCvBuilder(cv) {
    const p = cv.personal || {};
    const links = [p.linkedin, p.website].filter(Boolean).map((u) => ({ label: linkLabel(u), url: withScheme(u) }));
    return {
      profile: { name: p.fullName || '', headline: p.headline || '', email: p.email || '', location: p.location || '', links },
      about: cv.summary || '',
      experience: (cv.experience || []).map((e) => ({
        role: e.title || '', org: e.org || '', orgUrl: '', type: '', location: e.location || '',
        start: e.start || '', end: isPresent(e.end) ? '' : e.end || '', current: isPresent(e.end),
        summary: '', highlights: lines(e.bullets), tags: [],
      })),
      education: (cv.education || []).map((e) => ({
        qualification: e.qualification || '', school: e.institution || '', location: e.location || '',
        start: e.start || '', end: e.end || '', grade: e.grade || '', details: lines(e.bullets),
      })),
      skills: (cv.skills || []).map((s) => ({
        group: s.category || 'Skills',
        items: String(s.items || '').split(',').map((x) => x.trim()).filter(Boolean).map((name) => ({ name })),
      })).filter((g) => g.items.length),
      projects: (cv.projects || []).map((pr) => ({
        id: '', title: pr.name || '', summary: lines(pr.bullets)[0] || '',
        description: lines(pr.bullets).map((b) => '- ' + b).join('\n'),
        tags: [], date: pr.start || '', role: pr.role || '', featured: false, hidden: false,
        links: pr.link ? [{ label: /github|gitlab/i.test(pr.link) ? 'Source code' : 'Link', url: withScheme(pr.link) }] : [], media: [],
      })),
      certifications: (cv.certifications || []).map((c) => ({ name: c.name || '', issuer: c.issuer || '', date: c.date || '', url: '' })),
    };
  }

  // ---------- reading files (browser only) ----------

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.append(s);
    });
  }

  // pdf.js (Mozilla, Apache-2.0) is vendored and loaded only when a PDF is imported.
  async function pdfToText(file) {
    if (!root.pdfjsLib) {
      await loadScript('vendor/pdfjs/pdf.min.js');
      // Loading the worker as a plain script lets pdf.js run on the main thread,
      // which also works when the editor is opened from file://.
      await loadScript('vendor/pdfjs/pdf.worker.min.js');
      root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
    }
    const pdf = await root.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      // Group text pieces into lines by their vertical position, then read left to right.
      const rows = [];
      content.items.forEach((item) => {
        if (!item.str || !item.str.trim()) return;
        const y = item.transform[5];
        const x = item.transform[4];
        let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
        if (!row) { row = { y, parts: [] }; rows.push(row); }
        row.parts.push({ x, width: item.width, str: item.str });
      });
      rows.sort((a, b) => b.y - a.y).forEach((row) => {
        row.parts.sort((a, b) => a.x - b.x);
        let line = '';
        let end = null;
        row.parts.forEach((part) => {
          if (end !== null && part.x - end > 1) line += part.x - end > 20 ? '   ' : ' ';
          line += part.str;
          end = part.x + part.width;
        });
        out.push(line.replace(/\s{2,}(?=\S)/g, (gap) => (gap.length >= 3 ? '   ' : ' ')));
      });
      out.push('');
    }
    return out.join('\n');
  }

  // Minimal .zip reader for .docx files, using the browser's built-in DecompressionStream.
  async function unzipEntry(buffer, wanted) {
    const view = new DataView(buffer);
    let eocd = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This does not look like a Word .docx file.');
    let ptr = view.getUint32(eocd + 16, true);
    const count = view.getUint16(eocd + 10, true);
    for (let n = 0; n < count; n++) {
      const method = view.getUint16(ptr + 10, true);
      const size = view.getUint32(ptr + 20, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const local = view.getUint32(ptr + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(buffer, ptr + 46, nameLen));
      if (name === wanted) {
        const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const data = new Uint8Array(buffer, dataStart, size);
        if (method === 0) return new TextDecoder().decode(data);
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).text();
      }
      ptr += 46 + nameLen + extraLen + commentLen;
    }
    throw new Error('This Word file has no document text.');
  }

  async function docxToText(file) {
    const xml = await unzipEntry(await file.arrayBuffer(), 'word/document.xml');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    return [...doc.getElementsByTagNameNS(W, 'p')].map((p) => {
      let text = '';
      p.querySelectorAll('*').forEach((el) => {
        if (el.namespaceURI !== W) return;
        if (el.localName === 't') text += el.textContent;
        else if (el.localName === 'tab') text += '   ';
        else if (el.localName === 'br') text += '\n';
      });
      const isListItem = p.getElementsByTagNameNS(W, 'numPr').length > 0;
      return (isListItem && text.trim() ? '• ' : '') + text;
    }).join('\n');
  }

  // Reads any supported CV file and returns { result, kind }.
  async function importCvFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
      const data = JSON.parse(await file.text());
      if (!data || !data.personal) throw new Error('This .json file is not a CV Builder save file.');
      return { kind: 'cv-builder', result: fromCvBuilder(data) };
    }
    if (name.endsWith('.pdf') || file.type === 'application/pdf') return { kind: 'pdf', result: parseCvText(await pdfToText(file)) };
    if (name.endsWith('.docx')) return { kind: 'docx', result: parseCvText(await docxToText(file)) };
    if (name.endsWith('.doc')) throw new Error('Old .doc files cannot be read. Save it as .docx or PDF first.');
    if (name.endsWith('.txt') || file.type === 'text/plain') return { kind: 'text', result: parseCvText(await file.text()) };
    throw new Error('Choose a PDF, a Word .docx file or a CV Builder .json file.');
  }

  const api = { parseCvText, fromCvBuilder, toYearMonth, findRange, importCvFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PF = Object.assign(root.PF || {}, { cvImport: api });
})(typeof window !== 'undefined' ? window : globalThis);
