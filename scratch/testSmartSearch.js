const testCases = [
  { label: 'Search: "Gudur"', url: 'http://localhost:5000/api/college/directory?query=Gudur' },
  { label: 'Search: "Tirupati"', url: 'http://localhost:5000/api/college/directory?query=Tirupati' },
  { label: 'Search: "JNTUA"', url: 'http://localhost:5000/api/college/directory?query=JNTUA' },
  { label: 'Fuzzy: "Gudr" (typo)', url: 'http://localhost:5000/api/college/directory?query=Gudr' },
  { label: 'Fuzzy: "Tirupti" (typo)', url: 'http://localhost:5000/api/college/directory?query=Tirupti' },
  { label: 'Fuzzy: "Audisankra" (typo)', url: 'http://localhost:5000/api/college/directory?query=Audisankra' },
  { label: 'Search: "Engineering"', url: 'http://localhost:5000/api/college/directory?query=Engineering' },
  { label: 'Search: "Andhra Pradesh"', url: 'http://localhost:5000/api/college/directory?query=Andhra%20Pradesh' },
];

const run = async () => {
  for (const tc of testCases) {
    try {
      const res = await fetch(tc.url);
      const data = await res.json();
      const top3 = data.slice(0, 3).map(c => `${c.name} (${c.city || c.district}) ★${c.rating || '?'} score=${c.relevanceScore || '?'}`);
      console.log(`\n${tc.label}`);
      console.log(`  Results: ${data.length}`);
      top3.forEach((t, i) => console.log(`  ${i+1}. ${t}`));
    } catch (err) {
      console.error(`${tc.label} → ERROR: ${err.message}`);
    }
  }
};

run();
