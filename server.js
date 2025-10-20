// server.js
import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS許可（フロントのローカル開発用）
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

const SOURCE_URL = "https://www.sotetsu.co.jp/train/status/other-route/";

app.get("/api/other-route", async (req, res) => {
  try {
    const resp = await fetch(SOURCE_URL, {
      headers: {
        // サイト側がUAで弾く場合の対策（礼儀として一般的なUAを付与）
        "User-Agent":
          "Mozilla/5.0 (compatible; DelayTicker/1.0; +https://example.com)"
      }
    });
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Upstream ${resp.status}` });
    }
    const html = await resp.text();
    const $ = cheerio.load(html);

    // ====== ここからパース ======
    // ページ冒頭の説明など（任意）
    const pageTitle = $("title").first().text().trim();

    // 「他社線運行情報」のアイテムを想定セレクタで抽出
    // 例）.c-other-route__item や .p-other-route__item, li要素 等に合わせてお好みで調整
    // 下は「li」列挙を汎用抽出 → テキストが実体のあるものだけ拾う方式
    const items = [];
    $("li, .other-route-item, .c-other-route__item, .p-other-route__item").each(
      (i, el) => {
        const text = $(el).text().replace(/\s+/g, " ").trim();
        if (!text) return;

        // リンクがあれば付与
        const link =
          $(el).find("a").attr("href") ||
          $(el).closest("a").attr("href") ||
          null;
        const absoluteLink =
          link && link.startsWith("http")
            ? link
            : link
            ? new URL(link, SOURCE_URL).toString()
            : null;

        items.push({
          text,
          link: absoluteLink
        });
      }
    );

    // ノイズっぽい短文や重複を軽くフィルタ
    const unique = [];
    const seen = new Set();
    for (const it of items) {
      const key = it.text;
      if (key.length < 6) continue; // 短すぎる行は除外
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(it);
    }

    res.json({
      source: SOURCE_URL,
      title: pageTitle,
      fetchedAtJST: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      count: unique.length,
      items: unique
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
