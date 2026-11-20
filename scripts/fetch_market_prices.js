const fs = require('fs');
const https = require('https');
const path = require('path');

function fetchYahoo(ticker) {
  return new Promise((resolve, reject) => {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d';
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (!j.chart || !j.chart.result || !j.chart.result[0]) {
            return reject(new Error('Invalid structure for ' + ticker));
          }
          const meta = j.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || price;
          const chgPct = prev ? ((price - prev) / prev) * 100 : 0;
          resolve({ price, prev, chgPct });
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function formatUSD(num) {
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatINR(num) {
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatChange(chg) {
  const isUp = chg > 0.0001;
  const isDown = chg < -0.0001;
  return {
    cls: isUp ? 'up' : (isDown ? 'down' : 'flat'),
    text: (isUp ? '▲ ' : (isDown ? '▼ ' : '● ')) + Math.abs(chg).toFixed(2) + '%'
  };
}

async function main() {
  console.log('Fetching live market quotes from Yahoo Finance / Global Feeds...');

  try {
    const [cl, gc, inr] = await Promise.all([
      fetchYahoo('CL=F'),
      fetchYahoo('GC=F'),
      fetchYahoo('INR=X')
    ]);

    // IBJA 1g 22K Gold Rate calculation:
    // 1 troy ounce = 31.1034768 grams pure gold (24K)
    // 24K INR per gram = (Gold COMEX USD / 31.1034768) * USDINR * 1.06 (customs duty/cess parity)
    // 22K INR per gram = 24K * (22 / 24)
    const pure24k_inr_g = (gc.price / 31.1034768) * inr.price * 1.06;
    const ibja22k_inr_g = pure24k_inr_g * (22 / 24);

    const clChg = formatChange(cl.chgPct);
    const gcChg = formatChange(gc.chgPct);
    const inrChg = formatChange(inr.chgPct);
    const goldIndChg = formatChange(gc.chgPct);

    const data = {
      updated_at: new Date().toISOString(),
      assets: [
        {
          symbol: 'CRUDE OIL',
          display_name: 'CRUDE OIL',
          ticker: 'CL=F',
          source: 'NYMEX WTI',
          price: cl.price,
          currency: 'USD',
          formatted_price: formatUSD(cl.price),
          change_pct: parseFloat(cl.chgPct.toFixed(2)),
          change_cls: clChg.cls,
          change_text: clChg.text
        },
        {
          symbol: 'GOLD COMEX',
          display_name: 'GOLD COMEX',
          ticker: 'GC=F',
          source: 'COMEX Gold',
          price: gc.price,
          currency: 'USD',
          formatted_price: formatUSD(gc.price),
          change_pct: parseFloat(gc.chgPct.toFixed(2)),
          change_cls: gcChg.cls,
          change_text: gcChg.text
        },
        {
          symbol: 'GOLD SPOT (IND 1g 22K)',
          display_name: 'GOLD (IND 22K)',
          ticker: 'IBJA:22K_1G',
          source: 'IBJA 22K 1g Spot',
          price: parseFloat(ibja22k_inr_g.toFixed(2)),
          currency: 'INR',
          formatted_price: formatINR(ibja22k_inr_g),
          change_pct: parseFloat(gc.chgPct.toFixed(2)),
          change_cls: goldIndChg.cls,
          change_text: goldIndChg.text
        },
        {
          symbol: 'USD/INR',
          display_name: 'USD/INR',
          ticker: 'INR=X',
          source: 'Forex Interbank',
          price: inr.price,
          currency: 'INR',
          formatted_price: formatINR(inr.price),
          change_pct: parseFloat(inr.chgPct.toFixed(2)),
          change_cls: inrChg.cls,
          change_text: inrChg.text
        }
      ]
    };

    const outPath = path.resolve(__dirname, '..', 'market_prices.json');
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Successfully saved to market_prices.json:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching market prices:', err);
    process.exit(1);
  }
}

main();
