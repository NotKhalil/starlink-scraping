import puppeteer from "puppeteer";

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

async function openUrl(pageUrl){
    const page = await browser.newPage();
    await page.goto(pageUrl);
}

const url = await getDebuggerUrl();

const browser = await puppeteer.connect({browserWSEndpoint: url, defaultViewport: null})
await openUrl('https://starlink.com/');

browser.disconnect();