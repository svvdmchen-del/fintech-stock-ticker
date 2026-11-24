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
    const [cl, gc, inr, ibja] = await Promise.all([
      fetchYahoo('CL=F'),
      fetchYahoo('GC=F'),
      fetchYahoo('INR=X'),
      fetchIBJA()
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
