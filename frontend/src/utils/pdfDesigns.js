import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fallbackLogo from "../assets/logo.png";

const BRAND = {
  primary: [14, 165, 233], // Sky 500
  dark: [15, 23, 42], // Slate 900
  darker: [2, 6, 23], // Slate 950
  white: [255, 255, 255],
  gray: [100, 116, 139], // Slate 500
  lightGray: [248, 250, 252], // Slate 50
  border: [226, 232, 240], // Slate 200
  green: [16, 185, 129], // Emerald 500
  lightGreen: [209, 250, 229], // Emerald 100
  orange: [245, 158, 11], // Amber 500
  red: [239, 68, 68], // Red 500
  text: [15, 23, 42], // Slate 900
  textLight: [71, 85, 105], // Slate 600
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value, locale = "en-GB") => {
  const parsed = toDate(value) || new Date();
  return parsed.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatPKR = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK")}`;

const methodLabelMap = {
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  bank_transfer: "Bank Transfer",
};

const normalizeMethodLabel = (method) => {
  const key = String(method || "").toLowerCase();
  return methodLabelMap[key] || method || "-";
};

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const getImageFormat = (dataUrl) => {
  const value = String(dataUrl || "").toLowerCase();
  if (value.includes("image/jpeg") || value.includes("image/jpg")) return "JPEG";
  return "PNG";
};

const fetchAsDataUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch image");
  const blob = await response.blob();
  return toDataUrl(blob);
};

const loadLogo = async (logoUrl) => {
  try {
    if (!logoUrl) throw new Error("No remote logo");
    return await fetchAsDataUrl(logoUrl);
  } catch {
    try {
      if (fallbackLogo) {
        return await fetchAsDataUrl(fallbackLogo);
      }
    } catch {
      // ignore and try public fallback
    }

    try {
      return await fetchAsDataUrl("/logo.png");
    } catch {
      return null;
    }
  }
};

const drawHeader = (doc, logoData, title, subtitle, W) => {
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, W, 48, "F");

  // Premium accent line at bottom of header
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 48, W, 1.5, "F");

  // Logo handling
  if (logoData) {
    try {
      doc.addImage(logoData, getImageFormat(logoData), 14, 10, 28, 28);
    } catch {
      doc.setFillColor(...BRAND.primary);
      doc.circle(28, 24, 14, "F");
      doc.setTextColor(...BRAND.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("S", 28, 29, { align: "center" });
    }
  } else {
    doc.setFillColor(...BRAND.primary);
    doc.circle(28, 24, 14, "F");
    doc.setTextColor(...BRAND.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("S", 28, 29, { align: "center" });
  }

  // Institution Title
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("SUM Academy", 50, 23);

  // Institution Subtitle
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Medical Learning Excellence", 50, 31);

  // Document Title (Right aligned)
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, W - 14, 23, { align: "right" });

  // Document Subtitle / Number
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, W - 14, 31, { align: "right" });
};

const drawFooter = (doc, W, H, pageNum, totalPages) => {
  doc.setFillColor(...BRAND.lightGray);
  doc.rect(0, H - 20, W, 20, "F");

  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.5);
  doc.line(0, H - 20, W, H - 20);

  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("SUM Academy  |  support@sumacademy.net  |  Karachi, Pakistan", 14, H - 8.5);
  
  if (totalPages > 0) {
    doc.text(`Page ${pageNum} of ${totalPages}`, W - 14, H - 8.5, { align: "right" });
  }
};

const drawInfoRow = (doc, x, y, label, value, WCol) => {
  // Line separator instead of box for a cleaner look
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.3);
  doc.line(x, y + 8, x + WCol, y + 8);

  doc.setTextColor(...BRAND.textLight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(label, x, y + 5);

  doc.setTextColor(...BRAND.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(String(value || "-"), x + WCol, y + 5, { align: "right" });
};

const drawStatusBadge = (doc, x, y, text, color) => {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, 36, 9, 4.5, 4.5, "F"); // Fully rounded modern badge
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(String(text || "pending").toUpperCase(), x + 18, y + 6, { align: "center" });
};

export const generateInvoicePDF = async ({
  invoiceId,
  studentName,
  studentEmail,
  studentPhone,
  courseName,
  className,
  shiftName,
  method,
  originalAmount,
  discountAmount,
  promoCode,
  finalAmount,
  status,
  paymentDate,
  referenceNumber,
  logoUrl,
}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const logo = await loadLogo(logoUrl);

  drawHeader(
    doc,
    logo,
    "INVOICE",
    `#${String(invoiceId || "XXXXXXXX").slice(-8).toUpperCase()}`,
    W
  );

  let y = 62;

  const normalizedStatus = String(status || "pending").toLowerCase();
  const statusColor =
    normalizedStatus === "paid"
      ? BRAND.green
      : normalizedStatus === "pending_verification"
        ? BRAND.orange
        : BRAND.red;

  drawStatusBadge(doc, 14, y, normalizedStatus, statusColor);
  y += 18;

  const col1X = 14;
  const col2X = 116;
  const colW = 80;

  // Student Info Section
  doc.setTextColor(...BRAND.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BILL TO", col1X, y);
  y += 6;

  drawInfoRow(doc, col1X, y, "Student Name", studentName, colW);
  drawInfoRow(doc, col1X, y + 12, "Email", studentEmail, colW);
  drawInfoRow(doc, col1X, y + 24, "Phone", studentPhone, colW);

  // Invoice Details Section
  const y2 = y - 6;
  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("INVOICE DETAILS", col2X, y2);

  const invoiceDate = formatDate(paymentDate);

  drawInfoRow(doc, col2X, y2 + 6, "Invoice ID", `#${String(invoiceId || "-").slice(-8).toUpperCase()}`, colW);
  drawInfoRow(doc, col2X, y2 + 18, "Date", invoiceDate, colW);
  drawInfoRow(doc, col2X, y2 + 30, "Reference", referenceNumber || "-", colW);

  y += 42;

  // Enrolled Course Section (Premium Card)
  doc.setFillColor(...BRAND.lightGray);
  doc.roundedRect(14, y, W - 28, 28, 4, 4, "F");
  
  doc.setFillColor(...BRAND.primary);
  doc.roundedRect(14, y, 4, 28, 4, 4, "F");

  doc.setTextColor(...BRAND.textLight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("ENROLLED COURSE", 24, y + 10);

  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(courseName || "-", 24, y + 18);

  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text([className, shiftName].filter(Boolean).join("  •  ") || "-", 24, y + 25);

  y += 36;

  // Payment Breakdown
  doc.setTextColor(...BRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PAYMENT BREAKDOWN", 14, y + 5);
  y += 10;

  const rows = [["Course Fee", formatPKR(originalAmount)]];
  if (Number(discountAmount || 0) > 0) {
    rows.push(["Discount Applied", `- ${formatPKR(discountAmount)}`]);
  }
  if (promoCode) {
    rows.push(["Promo Code", String(promoCode)]);
  }
  rows.push(["Payment Method", normalizeMethodLabel(method)]);

  autoTable(doc, {
    startY: y,
    head: [],
    body: rows,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: BRAND.text,
    },
    columnStyles: {
      0: { fontStyle: "normal", textColor: BRAND.textLight, cellWidth: 100 },
      1: { fontStyle: "bold", halign: "right", cellWidth: 82 },
    },
    margin: { left: 14, right: 14 },
    willDrawCell: (data) => {
      // Add subtle bottom border to all rows except last
      if (data.row.index < rows.length - 1) {
        doc.setDrawColor(...BRAND.border);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  y = (doc.lastAutoTable?.finalY || y) + 8;

  // Total Block
  doc.setFillColor(...BRAND.dark);
  doc.roundedRect(14, y, W - 28, 20, 4, 4, "F");

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("TOTAL AMOUNT PAID", 22, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(formatPKR(finalAmount), W - 22, y + 13, { align: "right" });
  y += 30;

  if (normalizedStatus === "paid") {
    // Watermark/Stamp
    doc.setDrawColor(...BRAND.green);
    doc.setLineWidth(1.5);
    doc.roundedRect(W - 66, y - 24, 52, 16, 4, 4);
    doc.setTextColor(...BRAND.green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PAID", W - 40, y - 13, { align: "center" });
    doc.setFontSize(8);
    doc.text(invoiceDate, W - 40, y - 6.5, { align: "center" });
  }

  y += 10;
  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "Thank you for choosing SUM Academy. This is your official payment invoice.",
    W / 2,
    y + 6,
    { align: "center" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("For queries contact: support@sumacademy.net", W / 2, y + 12, {
    align: "center",
  });

  drawFooter(doc, W, H, 1, 1);

  doc.save(`SUM_Invoice_${String(invoiceId || "invoice").slice(-8)}.pdf`);
};

export const generateReceiptPDF = async ({
  receiptId,
  studentName,
  studentEmail,
  courseName,
  className,
  amount,
  method,
  referenceNumber,
  paymentDate,
  verifiedBy,
  verifiedAt,
  logoUrl,
}) => {
  const doc = new jsPDF({ unit: "mm", format: [148, 210] });
  const W = 148;
  const H = 210;
  const logo = await loadLogo(logoUrl);

  drawHeader(doc, logo, "RECEIPT", "Payment Confirmation", W);

  let y = 58;

  // Success Banner
  doc.setFillColor(...BRAND.lightGreen);
  doc.roundedRect(10, y, W - 20, 14, 4, 4, "F");

  doc.setFillColor(...BRAND.green);
  doc.circle(20, y + 7, 4, "F");
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("✓", 20, y + 9.5, { align: "center" });

  doc.setTextColor(...BRAND.green);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Payment Verified", 28, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    verifiedAt
      ? `Confirmed on ${formatDate(verifiedAt)}`
      : "Payment confirmed by SUM Academy",
    28,
    y + 10.5
  );
  y += 22;

  // Receipt Details
  doc.setTextColor(...BRAND.textLight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RECEIPT DETAILS", 10, y);
  doc.setTextColor(...BRAND.dark);
  doc.text(`#${String(receiptId || "XXXXXXXXXX").toUpperCase().slice(-10)}`, W - 10, y, {
    align: "right",
  });
  y += 4;

  const colW = W - 20;
  const details = [
    ["Student Name", studentName || "-"],
    ["Email", studentEmail || "-"],
    ["Course", courseName || "-"],
    ["Class", className || "-"],
    ["Method", normalizeMethodLabel(method)],
    ["Reference", referenceNumber || "-"],
    ["Date", formatDate(paymentDate)],
    ["Verified By", verifiedBy || "System"],
  ];

  details.forEach(([label, value]) => {
    drawInfoRow(doc, 10, y, label, value, colW);
    y += 12;
  });

  y += 6;

  // Amount Block
  doc.setFillColor(...BRAND.dark);
  doc.roundedRect(10, y, W - 20, 22, 4, 4, "F");

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL PAID", 16, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(formatPKR(amount), W - 16, y + 13, { align: "right" });
  y += 32;

  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("This receipt confirms your payment to SUM Academy.", W / 2, y + 6, {
    align: "center",
  });
  doc.text("Please keep this for your records.", W / 2, y + 10, {
    align: "center",
  });

  drawFooter(doc, W, H, 0, 0); // No pagination needed on simple receipt

  doc.save(`SUM_Receipt_${String(receiptId || "receipt").slice(-8)}.pdf`);
};

export const generateCertificatePDF = async ({
  certId,
  studentName,
  courseName,
  className,
  completionScope,
  completionTitle,
  issuedDate,
  instructorName,
  logoUrl,
}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297;
  const H = 210;
  const logo = await loadLogo(logoUrl);

  doc.setFillColor(245, 252, 255);
  doc.rect(0, 0, W, H, "F");

  doc.setFillColor(225, 245, 250);
  doc.circle(26, 24, 18, "F");
  doc.circle(W - 24, H - 20, 24, "F");
  doc.setFillColor(220, 252, 231);
  doc.circle(W - 40, 28, 12, "F");

  doc.setDrawColor(178, 229, 241);
  doc.setLineWidth(1.1);
  doc.roundedRect(10, 10, W - 20, H - 20, 4, 4);
  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, 14, W - 28, H - 28, 3, 3);

  doc.setFillColor(8, 145, 178);
  doc.rect(0, 0, W, 12, "F");

  if (logo) {
    try {
      doc.addImage(logo, getImageFormat(logo), 18, 20, 22, 22);
    } catch {
      doc.setFillColor(8, 145, 178);
      doc.circle(29, 31, 11, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("S", 29, 35, { align: "center" });
    }
  } else {
    doc.setFillColor(8, 145, 178);
    doc.circle(29, 31, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("S", 29, 35, { align: "center" });
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SUM Academy", 46, 28);
  doc.setTextColor(8, 145, 178);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Medical Learning Excellence", 46, 35);

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("sumacademy.net", W - 20, 28, { align: "right" });

  doc.setTextColor(14, 116, 144);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setCharSpace(3.5);
  doc.text("CERTIFICATE OF COMPLETION", W / 2, 58, { align: "center" });
  doc.setCharSpace(0);

  doc.setDrawColor(125, 211, 252);
  doc.setLineWidth(0.8);
  doc.line(28, 63, W - 28, 63);
  doc.setFillColor(8, 145, 178);
  doc.circle(W / 2, 63, 1.6, "F");
  doc.setFillColor(22, 163, 74);
  doc.rect(W / 2 - 0.6, 62, 1.2, 3.2, "F");
  doc.rect(W / 2 - 1.6, 63, 3.2, 1.2, "F");

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("This is to certify that", W / 2, 76, { align: "center" });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(33);
  doc.text(studentName || "Student Name", W / 2, 94, { align: "center" });

  const nameWidth = doc.getTextWidth(studentName || "Student Name");
  const nameX = (W - nameWidth) / 2;
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(1.2);
  doc.line(nameX, 97, nameX + nameWidth, 97);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.4);
  doc.line(nameX, 99, nameX + nameWidth, 99);

  const normalizedScope = String(completionScope || "").toLowerCase();
  const isClassScope = normalizedScope === "class";
  const achievedTitle =
    completionTitle ||
    (isClassScope
      ? className || courseName || "Class"
      : courseName || className || "Course");
  const scopeLabel = isClassScope ? "class" : "course";

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(`has successfully completed the ${scopeLabel}`, W / 2, 112, {
    align: "center",
  });

  doc.setTextColor(8, 145, 178);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(achievedTitle || "Completion", W / 2, 126, { align: "center" });

  doc.setDrawColor(125, 211, 252);
  doc.setLineWidth(0.3);
  doc.line(28, 136, W - 28, 136);
  doc.setLineWidth(0.8);
  doc.line(28, 138, W - 28, 138);
  doc.setFillColor(34, 197, 94);
  doc.circle(W / 2, 137, 1.7, "F");

  const bottomY = 150;

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("DATE OF ISSUE", 50, bottomY, { align: "center" });

  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.5);
  doc.line(25, bottomY + 2, 75, bottomY + 2);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(formatDate(issuedDate, "en-GB"), 50, bottomY + 10, { align: "center" });

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("CERTIFICATE ID", W / 2, bottomY, { align: "center" });

  doc.setFillColor(224, 242, 254);
  doc.roundedRect(W / 2 - 40, bottomY + 3, 80, 10, 2, 2, "F");
  doc.setDrawColor(125, 211, 252);
  doc.setLineWidth(0.3);
  doc.roundedRect(W / 2 - 40, bottomY + 3, 80, 10, 2, 2);
  doc.setTextColor(14, 116, 144);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text((certId || "SUM-XXXX-XXXXXXXX").toUpperCase(), W / 2, bottomY + 10, {
    align: "center",
  });

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("AUTHORIZED BY", W - 50, bottomY, { align: "center" });

  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.5);
  doc.line(W - 75, bottomY + 2, W - 25, bottomY + 2);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(instructorName || "SUM Academy", W - 50, bottomY + 10, { align: "center" });
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Academic Director", W - 50, bottomY + 16, { align: "center" });

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Verify at: sumacademy.net/verify/${certId || ""}`, W / 2, H - 18, {
    align: "center",
  });

  doc.save(`SUM_Certificate_${certId || "certificate"}.pdf`);
};
