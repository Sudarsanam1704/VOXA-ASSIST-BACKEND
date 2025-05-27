const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// List of paths to crawl on the website
const pathsToCrawl = ['/', '/about', '/contact'];
const baseURL = 'https://voxa-assist.vercel.app';  // Your React app base URL

async function crawlPage(browser, url) {
  try {
    console.log(`🌐 Crawling: ${url}`);
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36'
    );

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 40000,
    });

    // Wait extra time for any dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    const content = await page.content();
    await page.close();

    console.log(`✅ Finished crawling: ${url}, content length: ${content.length}`);
    return { url, content };
  } catch (err) {
    console.error(`❌ Error crawling ${url}:`, err.message);
    return { url, error: err.message };
  }
}

app.post('/crawl', async (req, res) => {
  let { url } = req.body;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    if (!url || url.trim() === '') {
      // Crawl all default paths sequentially
      const results = [];
      let combinedContent = '';

      for (const path of pathsToCrawl) {
        const fullURL = baseURL + path;
        const pageData = await crawlPage(browser, fullURL);

        results.push(pageData);

        // If successfully crawled, append content, else skip
        if (pageData.content) {
          combinedContent += `\n\n<!-- Content from ${pageData.url} -->\n\n` + pageData.content;
        }
      }

      // Log combined content in console
      console.log('=== COMBINED CRAWLED CONTENT START ===');
      console.log(combinedContent);
      console.log('=== COMBINED CRAWLED CONTENT END ===');

      await browser.close();

      // Send both individual results and combined content if needed
      res.send({ crawledPages: results, combinedContent });
    } else {
      // Crawl just the provided URL
      const pageData = await crawlPage(browser, url);

      await browser.close();

      // Log single page content
      if (pageData.content) {
        console.log(`=== CONTENT FROM ${pageData.url} START ===`);
        console.log(pageData.content);
        console.log(`=== CONTENT FROM ${pageData.url} END ===`);
      }

      res.send(pageData);
    }
  } catch (err) {
    await browser.close();
    res.status(500).send({ error: 'Failed to crawl: ' + err.message });
  }
});

app.listen(5000, () => {
  console.log('✅ Server running at http://localhost:5000');

  // Optional: Auto crawl on server start (can be removed or kept)
  (async () => {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      let combinedContent = '';
      for (const path of pathsToCrawl) {
        const pageData = await crawlPage(browser, baseURL + path);
        if (pageData.content) {
          combinedContent += `\n\n<!-- Content from ${pageData.url} -->\n\n` + pageData.content;
        }
      }

      console.log('=== AUTO CRAWL COMBINED CONTENT START ===');
      console.log(combinedContent);
      console.log('=== AUTO CRAWL COMBINED CONTENT END ===');

      await browser.close();
      console.log('✅ Auto crawling completed.');
    } catch (err) {
      console.error('❌ Auto crawl failed:', err.message);
      await browser.close();
    }
  })();
});
