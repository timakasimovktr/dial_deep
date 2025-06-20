const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

let browser;

app.post("/call", async (req, res) => {
  const { number } = req.body;
  if (!number) return res.status(400).send("Номер обязателен");

  try {
    const page = await browser.newPage();

    await page.goto("http://localhost:3000?number=" + encodeURIComponent(number), {
      waitUntil: "networkidle0",
    });

    await page.evaluate(() => {
      const btn = document.getElementById("start-call");
      if (btn) btn.click();
    });

    res.send("Звонок запущен");
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка при запуске звонка");
  }
});

(async () => {
  browser = await puppeteer.launch({
    headless: false, // Headless режим не подходит для WebRTC
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const PORT = 8000;
  app.listen(PORT, () => console.log(`API сервер запущен на http://localhost:${PORT}`));
})();
