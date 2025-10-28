import puppeteer from 'puppeteer';

export const generateLedgerPDF = async (ledgerData, customerData, startDate, endDate) => {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Generate HTML content based on the frontend template
    const htmlContent = generateLedgerHTML(ledgerData, customerData, startDate, endDate);
    
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });
    
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const generateLedgerHTML = (ledgerData, customerData, startDate, endDate) => {
  const { openingBalance, ledgerEntries, closingBalance } = ledgerData;
  const [customerName, customerAddress, customerGst] = customerData.data;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getBalance = (balance) => {
    if (balance === null || balance === undefined || balance === "")
      return "";
    return parseFloat(balance).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getOpeningBalanceDisplay = () => {
    if (openingBalance.isDebit) {
      return { debit: getBalance(openingBalance.amount), credit: "" };
    } else {
      return { debit: "", credit: getBalance(openingBalance.amount) };
    }
  };

  const getClosingBalanceDisplay = () => {
    if (closingBalance.isDebit) {
      return { debit: getBalance(closingBalance.amount), credit: "" };
    } else {
      return { debit: "", credit: getBalance(closingBalance.amount) };
    }
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #333;
          margin: 0;
          padding: 24px;
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
        }
        .header h1 {
          margin: 0;
          font-size: 18px;
          font-weight: bold;
        }
        .header p {
          margin: 0;
          font-size: 11px;
        }
        .customer-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .customer-details h2 {
          margin: 0;
          font-size: 16px;
          font-weight: bold;
        }
        .customer-details p {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
        }
        .customer-details .address {
          font-size: 10px;
          color: #666;
        }
        .date-range {
          text-align: right;
          font-size: 11px;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          page-break-inside: auto;
        }
        th, td {
          border: 1px solid #999;
          padding: 4px 8px;
          text-align: left;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .text-right {
          text-align: right;
        }
        .opening-balance {
          background-color: #f5f5f5;
        }
        .closing-balance {
          background-color: #f5f5f5;
        }
        .even-row {
          background-color: #fafafa;
        }
        .odd-row {
          background-color: white;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <!-- Company Header -->
      <div class="header">
        <h1>MAGNEQ TRANSMISSION PRIVATE LIMITED</h1>
        <p>PLOT NO.E-24/6, MIDC INDL.AREA, CHIKALTHANA, AURANGABAD</p>
      </div>

      <!-- Customer Info -->
      <div class="customer-info">
        <div class="customer-details">
          <h2>${customerName}</h2>
          <p>Ledger Account</p>
          <p class="address">${customerAddress}</p>
          <p class="address">GSTIN: ${customerGst}</p>
        </div>
        <div class="date-range">
          ${startDate && endDate ? `${formatDate(startDate)} to ${formatDate(endDate)}` : ''}
        </div>
      </div>

      <!-- Ledger Table -->
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Particulars</th>
            <th>Vch Type</th>
            <th>Vch No.</th>
            <th class="text-right">Debit (₹)</th>
            <th class="text-right">Credit (₹)</th>
          </tr>
        </thead>
        <tbody>
          <!-- Opening Balance -->
          <tr class="opening-balance">
            <td colspan="4" class="text-right" style="font-weight: bold;">Opening Balance</td>
            <td class="text-right">${getOpeningBalanceDisplay().debit}</td>
            <td class="text-right">${getOpeningBalanceDisplay().credit}</td>
          </tr>

          <!-- Ledger Entries -->
          ${ledgerEntries.map((entry, index) => `
            <tr class="${index % 2 === 0 ? 'even-row' : 'odd-row'}">
              <td>${formatDate(entry.date)}</td>
              <td>${entry.particulars}</td>
              <td>${entry.vchType || ''}</td>
              <td>${entry.vchNo || ''}</td>
              <td class="text-right">${entry.debit ? getBalance(entry.debit) : ''}</td>
              <td class="text-right">${entry.credit ? getBalance(entry.credit) : ''}</td>
            </tr>
          `).join('')}

          <!-- Closing Balance -->
          <tr class="closing-balance">
            <td colspan="4" class="text-right" style="font-weight: bold;">Closing Balance</td>
            <td class="text-right">${getClosingBalanceDisplay().debit}</td>
            <td class="text-right">${getClosingBalanceDisplay().credit}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
};
