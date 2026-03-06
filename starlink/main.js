import puppeteer from "puppeteer";

const URL = "https://starlink.com";

async function getDebuggerUrl() {
    try {
        const response = await fetch('http://127.0.0.1:9222/json/version');
        if (!response.ok) {
            console.error('Request failed: ', response.status);
            return;
        }
        const data = await response.json();
        return data.webSocketDebuggerUrl;
    } catch (error) {
        console.log(error);
    }
}

async function getServiceLinesUrls(page) {
    const hrefs = new Set();
    
    await page.waitForSelector('div[role="rowgroup"] div[role="row"]');

    const rowGroup = await page.$('div[role="rowgroup"]');
    const rows = await rowGroup.$$('div[role="row"]');

    for(const row of rows){
        const href = await row.$eval('a[role="link"]', el => el.getAttribute('href'));
        hrefs.add(href);
    }

    return hrefs;
}

async function scrapeLinesData(hrefs, page){
    for(const href of hrefs){
        await page.goto(URL + href);
        const nickname = await getNickname(page);
        console.log(nickname);
        const monthDataUsage = await getMonthlyUsage(page);
        console.log(monthDataUsage);
    }
}

async function getNickname(page){
    await page.waitForSelector('::-p-text(Nickname)');

    const nickname = await page.evaluate(() => {
        const stack = [...document.querySelectorAll('[data-sentry-component="SXTypography"]')].find(el => el.textContent.trim() === "Nickname");
        return stack?.nextElementSibling?.textContent?.trim() ?? null;
    });

    return nickname;
}

async function getMonthlyUsage(page){
    await page.waitForSelector('::-p-text(Monthly Data Usage)');

    const usage = await page.evaluate(() => {
        const div = [...document.querySelectorAll('[data-sentry-component="SXTypography"]')].find(el => el.textContent.trim() === "Monthly Data Usage");
        const data = div.parentElement?.nextElementSibling?.textContent ?? null;
        return data;
    });

    return usage;
}

function waitFor (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function run(){
    const url = await getDebuggerUrl();

    const browser = await puppeteer.connect({browserWSEndpoint: url, defaultViewport: null})
    
    const page = await browser.newPage();
    await page.goto(URL + '/account/dashboard');
    
    const hrefs = await getServiceLinesUrls(page);
    await scrapeLinesData(hrefs, page);

    browser.disconnect();
}

run();
