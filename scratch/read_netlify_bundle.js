const axios = require('axios');

async function inspectNetlify() {
  const rootUrl = 'https://studentosedu.netlify.app';
  console.log(`Downloading root HTML from ${rootUrl}...`);
  
  try {
    const htmlRes = await axios.get(rootUrl, { timeout: 15000 });
    const html = htmlRes.data;
    
    // Find script tags using regex
    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
    const scripts = [];
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      scripts.push(match[1]);
    }

    console.log('Script tags found in HTML:', scripts);

    for (const src of scripts) {
      if (src.includes('index-') && src.endsWith('.js')) {
        const jsUrl = src.startsWith('http') ? src : `${rootUrl}/${src.replace(/^\//, '')}`;
        console.log(`\nDownloading JS bundle from ${jsUrl}...`);
        
        const jsRes = await axios.get(jsUrl, { timeout: 20000 });
        const jsContent = jsRes.data;

        console.log('\n==================================================');
        console.log('         JS BUNDLE ANALYSIS RESULTS               ');
        console.log('==================================================');
        
        // Search for render.com URL occurrences
        const renderMatches = jsContent.match(/https?:\/\/[a-zA-Z0-9-]+\.onrender\.com[^\s"']*/g);
        console.log('1. Render URLs found in JS:', renderMatches);

        // Search for localhost occurrences
        const localhostMatches = jsContent.match(/https?:\/\/localhost:[0-9]+[^\s"']*/g);
        console.log('2. Localhost URLs found in JS:', localhostMatches);

        // Search for Google Client ID occurrences
        const googleMatches = jsContent.match(/[0-9]+-[a-zA-Z0-9_]+\.apps\.googleusercontent\.com/g);
        console.log('3. Google Client IDs found in JS:', googleMatches);
        console.log('==================================================\n');
      }
    }

  } catch (err) {
    console.error('Inspection failed:', err.message);
  }
}

inspectNetlify();
