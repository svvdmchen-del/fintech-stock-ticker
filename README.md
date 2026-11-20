# Panimalar MBA FinTech Lab — Live Stock Ticker

A lightweight, continuous scrolling stock ticker (1120x40px) displaying **Crude Oil (WTI NYMEX)**, **Gold (COMEX)**, **USD / INR**, major indices (**NIFTY 50**, **SENSEX**, etc.), and constituent stocks with **live prices via Google Finance & Google Sheets**.

Designed for display on laboratory LED ticker panels, TV screens, and website embedding.

---

## 🚀 Live Demo on GitHub Pages

Once deployed, your ticker will be live at:
```text
https://<your-username>.github.io/<your-repo-name>/
```

You can also dynamically test any other Google Sheet by adding the `?sheet=` URL parameter:
```text
https://<your-username>.github.io/<your-repo-name>/?sheet=YOUR_PUBLISHED_CSV_URL
```

---

## 🛠️ Step-by-Step GitHub Pages Setup

### 1. Create a GitHub Repository
1. Log in to [GitHub](https://github.com) and click **New Repository**.
2. Name it (for example `panimalar-ticker` or `fintech-stock-ticker`).
3. Set visibility to **Public** and click **Create repository**.

### 2. Push the Files
From this folder (`D:\temp\Ticker`), run the following commands:

```bash
git init
git add .
git commit -m "Initial commit of Panimalar FinTech Lab Stock Ticker"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```
*(Or simply drag and drop `index.html` and `google_sheets_nifty50_template.csv` directly into the GitHub web interface).*

### 3. Enable GitHub Pages
1. In your GitHub repository, click **Settings** (top right tab).
2. On the left sidebar, click **Pages**.
3. Under **Build and deployment**:
   * **Source**: Select `Deploy from a branch`.
   * **Branch**: Select `main` and folder `/ (root)`.
4. Click **Save**.
5. Within 1–2 minutes, GitHub will generate your live URL:
   `https://<your-username>.github.io/<your-repo-name>/`

---

## 📊 Live Google Sheets Data Source Setup

1. Open [Google Sheets](https://sheets.new) and import `google_sheets_nifty50_template.csv`.
2. Configure price formulas:
   * **USD / INR**:
     * Price: `=GOOGLEFINANCE("CURRENCY:USDINR")`
     * Change %: `=GOOGLEFINANCE("CURRENCY:USDINR", "changepct")`
   * **Crude Oil (NYMEX: CLW00)**:
     * Live Quote: `=IMPORTXML("https://www.google.com/finance/quote/CLW00:NYMEX", "//*[@class='YMlKec fxKbKc']")`
     * Change %: `=IMPORTXML("https://www.google.com/finance/quote/CLW00:NYMEX", "//*[@class='JwB6zf']")`
   * **Gold (COMEX: GCW00)**:
     * Live Quote: `=IMPORTXML("https://www.google.com/finance/quote/GCW00:COMEX", "//*[@class='YMlKec fxKbKc']")`
     * Change %: `=IMPORTXML("https://www.google.com/finance/quote/GCW00:COMEX", "//*[@class='JwB6zf']")`
   * **Stocks & Indices**:
     * Price: `=GOOGLEFINANCE(B5, "price")`
     * Change %: `=GOOGLEFINANCE(B5, "changepct")`
3. Set recalculation to 1 minute:
   * **File** > **Settings** > **Calculation** > Set *Recalculation* to **"On change and every minute"**.
4. Publish as CSV:
   * **File** > **Share** > **Publish to web**.
   * Change "Web page" to **Comma-separated values (.csv)**.
   * Click **Publish** and copy the link.
5. Replace the default URL in `index.html` (`DEFAULT_SHEET_CSV_URL`) or pass it via `?sheet=...`.

---

## 🖥️ Embedding on College Portal

To embed this ticker into the Panimalar college website, department portal, or intranet:

```html
<iframe 
  src="https://<your-username>.github.io/<your-repo-name>/" 
  width="1120" 
  height="40" 
  frameborder="0" 
  scrolling="no" 
  style="border:none; overflow:hidden; display:block;">
</iframe>
```
