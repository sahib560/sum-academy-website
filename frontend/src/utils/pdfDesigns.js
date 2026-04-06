import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fallbackLogo from "../assets/logo.png";

const BRAND = {
  blue: [74, 99, 245],
  blueDark: [51, 71, 232],
  orange: [255, 111, 15],
  dark: [13, 15, 26],
  white: [255, 255, 255],
  gray: [100, 116, 139],
  lightGray: [241, 245, 249],
  lightBlue: [240, 244, 255],
  green: [22, 163, 74],
  lightGreen: [220, 252, 231],
  red: [220, 38, 38],
  border: [226, 232, 240],
  text: [26, 26, 46],
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
  doc.rect(0, 0, W, 42, "F");

  doc.setFillColor(...BRAND.blue);
  doc.rect(0, 0, 6, 42, "F");

  doc.setFillColor(...BRAND.orange);
  doc.rect(0, 40, W, 2, "F");

  if (logoData) {
    try {
      doc.addImage(logoData, getImageFormat(logoData), 12, 8, 26, 26);
    } catch {
      doc.setFillColor(...BRAND.blue);
      doc.circle(25, 21, 13, "F");
      doc.setTextColor(...BRAND.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("S", 25, 26, { align: "center" });
    }
  } else {
    doc.setFillColor(...BRAND.blue);
    doc.circle(25, 21, 13, "F");
    doc.setTextColor(...BRAND.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("S", 25, 26, { align: "center" });
  }

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SUM Academy", 46, 18);

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("sumacademy.net", 46, 26);

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, W - 14, 18, { align: "right" });

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(subtitle, W - 14, 26, { align: "right" });
};

const drawFooter = (doc, W, H, pageNum, totalPages) => {
  doc.setFillColor(...BRAND.lightGray);
  doc.rect(0, H - 16, W, 16, "F");

  doc.setFillColor(...BRAND.blue);
  doc.rect(0, H - 16, 4, 16, "F");

  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("SUM Academy  |  sumacademy.net  |  Karachi, Pakistan", 14, H - 7);
  doc.text(`Page ${pageNum} of ${totalPages}`, W - 14, H - 7, { align: "right" });
};

const drawInfoRow = (doc, x, y, label, value, WCol) => {
  doc.setFillColor(...BRAND.lightGray);
  doc.roundedRect(x, y, WCol, 9, 2, 2, "F");

  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(label, x + 4, y + 6);

  doc.setTextColor(...BRAND.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(String(value || "-"), x + WCol - 4, y + 6, { align: "right" });
};

const drawStatusBadge = (doc, x, y, text, color) => {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, 32, 8, 2, 2, "F");
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(String(text || "pending").toUpperCase(), x + 16, y + 5.5, { align: "center" });
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

  let y = 52;

  const normalizedStatus = String(status || "pending").toLowerCase();
  const statusColor =
    normalizedStatus === "paid"
      ? BRAND.green
      : normalizedStatus === "pending_verification"
        ? BRAND.orange
        : BRAND.red;

  drawStatusBadge(doc, 14, y, normalizedStatus, statusColor);
  y += 14;

  const col1X = 14;
  const col2X = 116;
  const colW = 80;

  doc.setFillColor(...BRAND.blue);
  doc.roundedRect(col1X, y, colW, 7, 2, 2, "F");
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("STUDENT INFORMATION", col1X + 4, y + 5);
  y += 10;

  drawInfoRow(doc, col1X, y, "Full Name", studentName, colW);
  drawInfoRow(doc, col1X, y + 11, "Email", studentEmail, colW);
  drawInfoRow(doc, col1X, y + 22, "Phone", studentPhone, colW);

  const y2 = y - 10;
  doc.setFillColor(...BRAND.dark);
  doc.roundedRect(col2X, y2, colW, 7, 2, 2, "F");
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("INVOICE DETAILS", col2X + 4, y2 + 5);

  const invoiceDate = formatDate(paymentDate);

  drawInfoRow(
    doc,
    col2X,
    y2 + 10,
    "Invoice ID",
    `#${String(invoiceId || "-").slice(-8).toUpperCase()}`,
    colW
  );
  drawInfoRow(doc, col2X, y2 + 21, "Date", invoiceDate, colW);
  drawInfoRow(doc, col2X, y2 + 32, "Reference", referenceNumber || "-", colW);

  y += 36;

  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.4);
  doc.line(14, y, W - 14, y);
  y += 8;

  doc.setFillColor(...BRAND.lightBlue);
  doc.roundedRect(14, y, W - 28, 32, 3, 3, "F");

  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(0.8);
  doc.line(14, y, 14, y + 32);

  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("ENROLLED COURSE", 20, y + 8);

  doc.setTextColor(...BRAND.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(courseName || "-", 20, y + 17);

  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text([className, shiftName].filter(Boolean).join("  |  ") || "-", 20, y + 25);

  y += 40;

  doc.setFillColor(...BRAND.dark);
  doc.roundedRect(14, y, W - 28, 7, 2, 2, "F");
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PAYMENT BREAKDOWN", 18, y + 5);
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
      fontSize: 9,
      cellPadding: 4,
      textColor: BRAND.text,
    },
    columnStyles: {
      0: { fontStyle: "normal", textColor: BRAND.gray, cellWidth: 100 },
      1: { fontStyle: "bold", halign: "right", cellWidth: 82 },
    },
    margin: { left: 14, right: 14 },
    alternateRowStyles: { fillColor: BRAND.lightGray },
  });

  y = (doc.lastAutoTable?.finalY || y) + 4;

  doc.setFillColor(...BRAND.blue);
  doc.roundedRect(14, y, W - 28, 16, 3, 3, "F");

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL AMOUNT PAID", 20, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(formatPKR(finalAmount), W - 18, y + 10, { align: "right" });
  y += 24;

  if (normalizedStatus === "paid") {
    doc.setDrawColor(...BRAND.green);
    doc.setLineWidth(1.5);
    doc.roundedRect(W - 62, y - 20, 44, 14, 4, 4);
    doc.setTextColor(...BRAND.green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PAID", W - 40, y - 9, { align: "center" });
    doc.setFontSize(7);
    doc.text(invoiceDate, W - 40, y - 3, { align: "center" });
  }

  y += 8;
  doc.setFillColor(...BRAND.lightGray);
  doc.roundedRect(14, y, W - 28, 14, 3, 3, "F");
  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.text(
    "Thank you for choosing SUM Academy. This is your official payment invoice.",
    W / 2,
    y + 6,
    { align: "center" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("For queries contact: support@sumacademy.net", W / 2, y + 11, {
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

  let y = 52;

  doc.setFillColor(...BRAND.lightGreen);
  doc.roundedRect(10, y, W - 20, 14, 3, 3, "F");
  doc.setDrawColor(...BRAND.green);
  doc.setLineWidth(0.8);
  doc.roundedRect(10, y, W - 20, 14, 3, 3);

  doc.setFillColor(...BRAND.green);
  doc.circle(20, y + 7, 4, "F");
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("OK", 20, y + 9.5, { align: "center" });

  doc.setTextColor(...BRAND.green);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Payment Verified and Confirmed", 28, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    verifiedAt
      ? `Verified on ${formatDate(verifiedAt)}`
      : "Payment confirmed by SUM Academy",
    28,
    y + 11
  );
  y += 20;

  doc.setFillColor(...BRAND.dark);
  doc.roundedRect(10, y, W - 20, 10, 2, 2, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("RECEIPT NUMBER", 14, y + 4.5);
  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`#${String(receiptId || "XXXXXXXXXX").toUpperCase().slice(-10)}`, W - 14, y + 7, {
    align: "right",
  });
  y += 16;

  const colW = W - 20;
  const details = [
    ["Student Name", studentName || "-"],
    ["Email", studentEmail || "-"],
    ["Course", courseName || "-"],
    ["Class", className || "-"],
    ["Payment Method", normalizeMethodLabel(method)],
    ["Reference", referenceNumber || "-"],
    ["Date", formatDate(paymentDate)],
    ["Verified By", verifiedBy || "SUM Academy"],
  ];

  details.forEach(([label, value]) => {
    drawInfoRow(doc, 10, y, label, value, colW);
    y += 11;
  });

  y += 4;

  doc.setFillColor(...BRAND.blue);
  doc.roundedRect(10, y, W - 20, 18, 3, 3, "F");

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("AMOUNT PAID", 16, y + 8);

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(formatPKR(amount), W - 14, y + 12, { align: "right" });
  y += 26;

  doc.setFillColor(...BRAND.lightGray);
  doc.roundedRect(10, y, W - 20, 16, 3, 3, "F");
  doc.setTextColor(...BRAND.gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text("This receipt confirms your payment to SUM Academy.", W / 2, y + 6, {
    align: "center",
  });
  doc.text("Please keep this for your records.", W / 2, y + 11, {
    align: "center",
  });

  drawFooter(doc, W, H, 1, 1);

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

  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, W, H, "F");

  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(1.5);
  doc.line(0, 0, 40, 0);
  doc.line(0, 0, 0, 40);
  doc.line(W, H, W - 40, H);
  doc.line(W, H, W, H - 40);

  doc.setDrawColor(...BRAND.orange);
  doc.setLineWidth(1);
  doc.line(W, 0, W - 40, 0);
  doc.line(W, 0, W, 40);
  doc.line(0, H, 40, H);
  doc.line(0, H, 0, H - 40);

  doc.setDrawColor(74, 99, 245, 0.3);
  doc.setLineWidth(0.5);
  doc.roundedRect(12, 12, W - 24, H - 24, 4, 4);

  if (logo) {
    try {
      doc.addImage(logo, getImageFormat(logo), 18, 18, 24, 24);
    } catch {
      doc.setFillColor(...BRAND.blue);
      doc.circle(30, 30, 12, "F");
      doc.setTextColor(...BRAND.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("S", 30, 35, { align: "center" });
    }
  } else {
    doc.setFillColor(...BRAND.blue);
    doc.circle(30, 30, 12, "F");
    doc.setTextColor(...BRAND.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("S", 30, 35, { align: "center" });
  }

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("SUM ACADEMY", W - 20, 26, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("sumacademy.net", W - 20, 32, { align: "right" });

  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(0.8);
  doc.line(20, 50, W - 20, 50);
  doc.setFillColor(...BRAND.orange);
  doc.circle(W / 2, 50, 2, "F");
  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(0.3);
  doc.line(20, 52, W - 20, 52);

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setCharSpace(4);
  doc.text("CERTIFICATE OF COMPLETION", W / 2, 66, { align: "center" });
  doc.setCharSpace(0);

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("This is to certify that", W / 2, 78, { align: "center" });

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(studentName || "Student Name", W / 2, 96, { align: "center" });

  const nameWidth = doc.getTextWidth(studentName || "Student Name");
  const nameX = (W - nameWidth) / 2;
  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(1.5);
  doc.line(nameX, 99, nameX + nameWidth, 99);
  doc.setDrawColor(...BRAND.orange);
  doc.setLineWidth(0.5);
  doc.line(nameX, 101, nameX + nameWidth, 101);

  const normalizedScope = String(completionScope || "").toLowerCase();
  const isClassScope = normalizedScope === "class";
  const achievedTitle =
    completionTitle ||
    (isClassScope
      ? className || courseName || "Class"
      : courseName || className || "Course");
  const scopeLabel = isClassScope ? "class" : "course";

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(`has successfully completed the ${scopeLabel}`, W / 2, 112, {
    align: "center",
  });

  doc.setTextColor(...BRAND.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(achievedTitle || "Completion", W / 2, 126, { align: "center" });

  doc.setDrawColor(...BRAND.blue);
  doc.setLineWidth(0.3);
  doc.line(20, 136, W - 20, 136);
  doc.setLineWidth(0.8);
  doc.line(20, 138, W - 20, 138);
  doc.setFillColor(...BRAND.orange);
  doc.circle(W / 2, 138, 2, "F");

  const bottomY = 150;

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("DATE OF ISSUE", 50, bottomY, { align: "center" });

  doc.setDrawColor(74, 99, 245);
  doc.setLineWidth(0.5);
  doc.line(25, bottomY + 2, 75, bottomY + 2);

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(formatDate(issuedDate, "en-GB"), 50, bottomY + 10, { align: "center" });

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("CERTIFICATE ID", W / 2, bottomY, { align: "center" });

  doc.setFillColor(26, 35, 60);
  doc.roundedRect(W / 2 - 40, bottomY + 3, 80, 10, 2, 2, "F");
  doc.setTextColor(...BRAND.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text((certId || "SUM-XXXX-XXXXXXXX").toUpperCase(), W / 2, bottomY + 10, {
    align: "center",
  });

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("AUTHORIZED BY", W - 50, bottomY, { align: "center" });

  doc.setDrawColor(74, 99, 245);
  doc.setLineWidth(0.5);
  doc.line(W - 75, bottomY + 2, W - 25, bottomY + 2);

  doc.setTextColor(...BRAND.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(instructorName || "SUM Academy", W - 50, bottomY + 10, { align: "center" });
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Director, SUM Academy", W - 50, bottomY + 16, { align: "center" });

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Verify at: sumacademy.net/verify/${certId || ""}`, W / 2, H - 18, {
    align: "center",
  });

  doc.save(`SUM_Certificate_${certId || "certificate"}.pdf`);
};
