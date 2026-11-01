/* Liberia viewer: Politics and government, who is who. Each card opens a panel with party and a short biography.
   Only facts from the linked source are shown. A person with no biography yet says so. Ethnicity is not shown. */
(function () {
  'use strict';
  var WHO = [
    { g: 'Executive', n: 'Joseph Nyuma Boakai Sr.', r: 'President', since: 'Since 22 January 2024', party: 'Unity Party',
      bio: 'Born in Worsonga, Lofa County, on 30 November 1944. Studied at the College of West Africa and the University of Liberia (business administration, 1972). Managed the Liberia Produce Marketing Corporation in the 1970s and 1980s, and was Minister of Agriculture under Samuel Doe. Vice President from 2006 to 2018 under Ellen Johnson Sirleaf. Lost the 2017 election, won the 2023 run-off, and has been President since 22 January 2024.',
      src: 'https://en.wikipedia.org/wiki/Joseph_Boakai' },
    { g: 'Executive', n: 'Jeremiah Kpan Koung', r: 'Vice President', since: 'Since 22 January 2024', party: 'Unity Party',
      bio: 'Born in Yekepa, Nimba County, on 17 March 1978. Business administration degree from Cuttington University. Elected to the House of Representatives in 2011 and to the Senate in 2020. Chosen as Joseph Boakai’s running mate in April 2023.',
      src: 'https://en.wikipedia.org/wiki/Jeremiah_Koung' },
    { g: 'Executive', n: 'Sara Beysolow Nyanti', r: 'Minister of Foreign Affairs', since: 'Appointed February 2024', party: 'Not stated in the source checked',
      bio: 'Born in 1968. Held senior posts in the Liberian Ministry of Health from 1999 to 2003, including Director of the National AIDS Control Program. Worked with the UN and UNICEF in several countries, then as UN Assistant Secretary-General and Deputy Special Representative in South Sudan until 2023. Foreign Minister from February 2024. Dean of the Cabinet.',
      src: 'https://en.wikipedia.org/wiki/Sara_Beysolow_Nyanti' },
    { g: 'Executive', n: 'Augustine Kpehe Ngafuan II', r: 'Minister of Finance and Development Planning', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Cllr. N. Oswald Tweh', r: 'Minister of Justice', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Dr. Louise M. Kpoto', r: 'Minister of Health', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Dr. J. Alexander Nuetah', r: 'Minister of Agriculture', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'R. Matenokay Tingban', r: 'Minister of Lands, Mines and Energy', since: 'Appointed November 2025 (per Wikipedia)', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Roland Lafayette Giddings', r: 'Minister of Public Works', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Gbeme Horace-Kollie', r: 'Minister of Gender, Children and Social Protection', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Magdalene Dagoseh', r: 'Minister of Commerce and Industry', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Jerolinmek M. Piah', r: 'Minister of Information, Culture and Tourism', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Cllr. Cooper W. Kruah', r: 'Minister of Labour', since: 'Appointed 2024', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Sirleaf Ralph Tyler', r: 'Minister of Transport', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Executive', n: 'Cornelia Kruah', r: 'Minister of Youth and Sports', since: '', party: 'To confirm', bio: '', src: 'https://cabinet.gov.lr/cabinet-members/' },
    { g: 'Legislature', n: 'Richard N. Koon', r: 'Speaker, House of Representatives', since: 'Elected 13 May 2025', party: 'Unity Party',
      bio: 'Born in Monrovia on 27 July 1970. Holds MBA degrees in accounting. Professor at the University of Liberia’s graduate school. First elected to the House for Montserrado County’s 11th district in 2017. Elected Speaker on 21 November 2024, an election the Supreme Court ruled illegal. Re-elected Speaker on 13 May 2025 after Jonathan Koffa resigned.',
      src: 'https://en.wikipedia.org/wiki/Richard_Koon' },
    { g: 'Legislature', n: 'Nyonblee Karnga-Lawrence', r: 'President Pro Tempore, Senate', since: 'Since January 2024', party: 'Liberty Party',
      bio: 'Born on 2 July 1968 in Grand Bassa County. Business management degree from the University of Liberia and an MBA from Kutztown University. Worked in public relations at the Liberia Petroleum Refining Company. Elected to the Senate for Grand Bassa County in a 2013 by-election and a full term in 2020. Leader of the Liberty Party since 2017.',
      src: 'https://en.wikipedia.org/wiki/Nyonblee_Karnga-Lawrence' },
    { g: 'Judiciary', n: 'To confirm', r: 'Chief Justice', since: '', party: '', bio: '', src: '' },
    { g: 'Executive', n: 'To confirm', r: 'Minister of Education', since: '', party: '', bio: '', src: '' },
    { g: 'Executive', n: 'To confirm', r: 'Minister of Defence', since: '', party: '', bio: '', src: '' },
    { g: 'Executive', n: 'To confirm', r: 'Minister of Internal Affairs', since: '', party: '', bio: '', src: '' },
    { g: 'Executive', n: 'To confirm', r: 'Minister of Posts and Telecommunications', since: '', party: '', bio: '', src: '' }
  ];
  var grid = document.getElementById('who-grid');
  var dlg = document.getElementById('who-dlg');
  if (!grid || !dlg) return;
  function initials(n) {
    var parts = n.replace(/[^A-Za-z\s]/g, '').split(/\s+/).filter(function (w) { return w && /^[A-Z]/.test(w) && ['Dr', 'Cllr', 'The'].indexOf(w) < 0; });
    return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() : '?';
  }
  function show(p) {
    var h = document.getElementById('who-dlg-h');
    h.textContent = p.n;
    document.getElementById('who-dlg-r').textContent = p.r + (p.since ? ' · ' + p.since : '');
    document.getElementById('who-dlg-p').textContent = 'Party: ' + (p.party || 'not applicable');
    document.getElementById('who-dlg-b').textContent = p.bio || 'Biography to add. Source checked: the office list, which does not give biographies.';
    var a = document.getElementById('who-dlg-s');
    if (p.src) { a.href = p.src; a.hidden = false; } else { a.hidden = true; }
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  WHO.forEach(function (p) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'who' + (p.party === 'To confirm' || p.n === 'To confirm' ? ' pending' : '');
    var av = document.createElement('span'); av.className = 'av'; av.setAttribute('aria-hidden', 'true');
    av.textContent = p.n === 'To confirm' ? '?' : initials(p.n);
    var t = document.createElement('div');
    var wn = document.createElement('div'); wn.className = 'wn'; wn.textContent = p.n === 'To confirm' ? 'To confirm' : p.n;
    var wr = document.createElement('div'); wr.className = 'wr'; wr.textContent = p.r;
    t.appendChild(wn); t.appendChild(wr);
    if (p.since) { var sn = document.createElement('div'); sn.className = 'wnote'; sn.textContent = p.since; t.appendChild(sn); }
    b.appendChild(av); b.appendChild(t);
    if (p.n !== 'To confirm') b.addEventListener('click', function () { show(p); });
    else b.disabled = true;
    grid.appendChild(b);
  });
  var close = document.getElementById('who-dlg-x');
  if (close) close.addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
})();
