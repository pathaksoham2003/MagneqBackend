// utils/ledgerTemplate.js
export const generateLedgerHTML = ({
    customer,
    startDate,
    endDate,
    ledgerEntries,
    openingBalance,
    closingBalance,
  }) => {
    const formatDate = (date) =>
      new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
  
    const getBalance = (balance) =>
      balance
        ? Number(balance).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "0.00";
  
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Ledger PDF</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #222;
          margin: 20px;
          font-size: 12px;
        }
        h1, h2, h3 {
          margin: 4px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        th, td {
          border: 1px solid #bbb;
          padding: 6px;
          text-align: left;
        }
        th {
          background-color: #f3f3f3;
        }
        tr:nth-child(even) {
          background: #fafafa;
        }
        .header {
          text-align: center;
          margin-bottom: 16px;
        }
        .info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>MAGNEQ TRANSMISSION PRIVATE LIMITED</h1>
        <p>PLOT NO.E-24/6, MIDC INDL.AREA, CHIKALTHANA, AURANGABAD</p>
      </div>
  
      <div class="info">
        <div>
          <h3>${customer.name}</h3>
          <p>Ledger Account</p>
          <p>${customer.address || ""}</p>
          <p>GSTIN: ${customer.gst_no || "-"}</p>
        </div>
        <div>
          <p><strong>Period:</strong><br>${formatDate(
            startDate
          )} - ${formatDate(endDate)}</p>
        </div>
      </div>
  
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Particulars</th>
            <th>Vch Type</th>
            <th>Vch No.</th>
            <th style="text-align:right;">Debit (₹)</th>
            <th style="text-align:right;">Credit (₹)</th>
          </tr>
        </thead>
        <tbody>
          
  
          ${ledgerEntries
            .map(
              (entry) => `
            <tr>
              <td>${formatDate(entry.date)}</td>
              <td>${entry.particulars}</td>
              <td>${entry.vchType || ""}</td>
              <td>${entry.vchNo || ""}</td>
              <td style="text-align:right;">${
                entry.debit ? getBalance(entry.debit) : ""
              }</td>
              <td style="text-align:right;">${
                entry.credit ? getBalance(entry.credit) : ""
              }</td>
            </tr>`
            )
            .join("")}
  

        </tbody>
      </table>
    </body>
    </html>
    `;
  };
  