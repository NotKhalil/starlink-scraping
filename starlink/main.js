import puppeteer from "puppeteer";

const URL = "https://starlink.com";
const cardFields = ["Starlink ID", "Software Version", "Serial Number", "Kit Number", "Uptime", "Last Updated"];
const cardFieldsSplit = ["Downlink Throughput", "Uplink Throughput", "Latency", "Ping Drop Rate", "Signal Quality", "Obstruction"];

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
        await page.goto(URL + href, { waitUntil: 'domcontentloaded' });
        const nickname = await getNickname(page);
        console.log(nickname);
        const [monthlyUsage, totalUsage] = await getMonthlyUsage(page);
        console.log(monthlyUsage);
        console.log(totalUsage);
        const cardData = {};
        for(const name of cardFields){
            const data = await getDataFromCard(page, name);
            cardData[name] = data;
        }
        for (const name of cardFieldsSplit){
            const data = await getDataFromCardSplit(page, name);
            cardData[name] = data;
        }
        console.log(cardData);
        console.log("\n------------------------------------------------------------------\n");
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

    const [used, total] = usage.split("/").map(s =>{
        const [value, unit] = s.split(" ");
        return {"value": parseFloat(value), "unit": unit};
    });

    return [used, total];
}

async function getDataFromCard(page, field){
    await page.waitForSelector(`::-p-text(${field})`);
    //yes, this is a very unclever and naive solution but I'll look for a better solution later.
    await waitFor(200);
    const value = await page.evaluate((field) => {
        const obj = [...document.querySelectorAll('[data-sentry-component="SXTypography"]')].find(el => el.textContent.trim() === field);
        const data = obj.parentElement?.nextElementSibling?.textContent ?? null;
        return data;
    }, field);

    return value;
}

async function getDataFromCardSplit(page, field){
    await page.waitForSelector(`::-p-text(${field})`);
    const value = await page.evaluate((field) => {
        const obj = [...document.querySelectorAll('[data-sentry-component="SXTypography"]')].find(el => el.textContent.trim() === field);
        const data = obj.parentElement?.nextElementSibling?.textContent ?? null;
        return data;
    }, field);
    
    const finalValues = {};
    const rawValues = value.split("·");
    
    for(const value of rawValues){
        const splitValue = value.trim().split(" ");
        if(splitValue[2]){
            finalValues[splitValue[0]] = splitValue[1] + splitValue[2];
        }else{
            finalValues[splitValue[0]] = splitValue[1];
        }
    } 

    return finalValues;
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
