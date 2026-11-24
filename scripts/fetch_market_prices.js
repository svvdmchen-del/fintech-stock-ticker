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

function fetchIBJA() {
  return new Promise((resolve) => {
    https.get('https://ibjarates.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          // Look for 916 purity (22 Karat) 1 gram live rate
          const match916 = d.match(/id="GoldRatesCompare916">([0-9,]+)<\/span>/);
          if (match916 && match916[1]) {
            const price = parseFloat(match916[1].replace(/,/g, ''));
            const isRed = d.includes('id="GoldRatesCompare916Red"');
            resolve({
              price,
              cls: isRed ? 'down' : 'up',
              change_text: isRed ? '▼' : '▲'
            });
            return;
          }
        } catch (_) {}
        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

function fetchNSE() {
  return new Promise((resolve) => {
    https.get('https://www.nseindia.in/api/allIndices', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Referer': 'https://www.nseindia.in/'
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (!j || !Array.isArray(j.data)) return resolve(null);
          const map = {};
          j.data.forEach(row => {
            if (!row.index || typeof row.last === 'undefined') return;
            map[row.index] = {
              price: parseFloat(String(row.last).replace(/,/g, '')),
              chgPct: parseFloat(row.percentChange) || 0
            };
          });
          resolve(map);
        } catch (_) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
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
  console.log('Fetching live market quotes from Yahoo Finance & IBJA Live...');

  try {
    const [cl, gc, inr, ibja, sensex, nse] = await Promise.all([
      fetchYahoo('CL=F'),
      fetchYahoo('GC=F'),
      fetchYahoo('INR=X'),
      fetchIBJA(),
      fetchYahoo('^BSESN').catch(() => null),
      fetchNSE()
    ]);

    const clChg = formatChange(cl.chgPct);
    const gcChg = formatChange(gc.chgPct);
    const inrChg = formatChange(inr.chgPct);

    // IBJA 1g 22K (916 Purity):
    // Use direct official ibjarates.com live rate if available
    let goldIndPrice = 11320;
    let goldIndCls = 'down';
    let goldIndText = '▼ ' + Math.abs(gc.chgPct).toFixed(2) + '%';

    if (ibja && ibja.price) {
      goldIndPrice = ibja.price;
      goldIndCls = ibja.cls;
      goldIndText = (ibja.cls === 'down' ? '▼ ' : '▲ ') + Math.abs(gc.chgPct).toFixed(2) + '%';
    } else {
      // Fallback calculation:
      const pure24k_inr_g = (gc.price / 31.1034768) * inr.price * 1.15;
      goldIndPrice = parseFloat((pure24k_inr_g * (22 / 24)).toFixed(2));
      goldIndCls = gcChg.cls;
      goldIndText = gcChg.text;
    }

    const nseIndices = [
      { symbol: 'NIFTY 500', index: 'NIFTY 500', ticker: 'INDEXNSE:NIFTY_500' },
      { symbol: 'NIFTY_AUTO', index: 'NIFTY AUTO', ticker: 'INDEXNSE:NIFTY_AUTO' },
      { symbol: 'NIFTY_ENERGY', index: 'NIFTY ENERGY', ticker: 'INDEXNSE:NIFTY_ENERGY' },
      { symbol: 'NIFTY_FIN_SERV', index: 'NIFTY FINANCIAL SERVICES', ticker: 'INDEXNSE:NIFTY_FIN_SERVICE' },
      { symbol: 'NIFTY_FMCG', index: 'NIFTY FMCG', ticker: 'INDEXNSE:NIFTY_FMCG' },
      { symbol: 'NIFTY_INFRA', index: 'NIFTY INFRASTRUCTURE', ticker: 'INDEXNSE:NIFTY_INFRA' },
      { symbol: 'NIFTY_IT', index: 'NIFTY IT', ticker: 'INDEXNSE:NIFTY_IT' },
      { symbol: 'NIFTY_MEDIA', index: 'NIFTY MEDIA', ticker: 'INDEXNSE:NIFTY_MEDIA' },
      { symbol: 'NIFTY_METAL', index: 'NIFTY METAL', ticker: 'INDEXNSE:NIFTY_METAL' },
      { symbol: 'NIFTY_PHARMA', index: 'NIFTY PHARMA', ticker: 'INDEXNSE:NIFTY_PHARMA' },
      { symbol: 'NIFTY_REALTY', index: 'NIFTY REALTY', ticker: 'INDEXNSE:NIFTY_REALTY' }
    ];

    const indexAssets = [];

    if (sensex) {
      const sxChg = formatChange(sensex.chgPct);
      indexAssets.push({
        symbol: 'SENSEX',
        display_name: 'SENSEX',
        ticker: '^BSESN',
        source: 'BSE via Yahoo Finance',
        price: sensex.price,
        currency: 'INR',
        formatted_price: formatINR(sensex.price),
        change_pct: parseFloat(sensex.chgPct.toFixed(2)),
        change_cls: sxChg.cls,
        change_text: sxChg.text
      });
    }

    if (nse) {
      nseIndices.forEach(item => {
        const q = nse[item.index];
        if (!q || !isFinite(q.price)) return;
        const chg = formatChange(q.chgPct);
        indexAssets.push({
          symbol: item.symbol,
          display_name: item.symbol,
          ticker: item.ticker,
          source: 'NSE India',
          price: q.price,
          currency: 'INR',
          formatted_price: formatINR(q.price),
          change_pct: parseFloat(q.chgPct.toFixed(2)),
          change_cls: chg.cls,
          change_text: chg.text
        });
      });
    }

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
          symbol: 'GOLD (IND 22K)',
          display_name: 'GOLD (IND 22K)',
          ticker: 'IBJA:916_1G',
          source: 'ibjarates.com (916 Purity)',
          price: goldIndPrice,
          currency: 'INR',
          formatted_price: formatINR(goldIndPrice),
          change_pct: parseFloat(gc.chgPct.toFixed(2)),
          change_cls: goldIndCls,
          change_text: goldIndText
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
        },
        ...indexAssets
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
