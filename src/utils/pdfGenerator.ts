import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from './numberToWords';

export const generateReceipt = async (order: any, user: any, appUrl: string = window.location.origin) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Logo
  try {
    const img = new Image();
    img.src = '/img/logo_orange_new.png';
    await Promise.race([
      new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Image Timeout')), 1500))
    ]);
    const imgWidth = 60;
    const imgHeight = 22;
    doc.addImage(img, 'PNG', (pageWidth - imgWidth) / 2, 10, imgWidth, imgHeight);
  } catch (e) {
    console.warn("Could not load logo for PDF receipt.", e);
  }

  // 2. Subtitle Address
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text("Bengaluru, India", pageWidth / 2, 36, { align: "center" });
  doc.text("Rukmini Knowledge Park, Kattigenahalli Yelahanka, Bengaluru - 560064", pageWidth / 2, 42, { align: "center" });

  // 3. Orange Title Banner
  const titleY = 48;
  doc.setFillColor(234, 115, 33); // REVA Orange
  const titleWidth = 80;
  doc.rect((pageWidth - titleWidth) / 2, titleY, titleWidth, 10, 'F');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("3D Print Receipt", pageWidth / 2, titleY + 7, { align: "center" });

  // 4. Receipt No & Date Boxes
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  const receiptNoStr = `Receipt No.: ${orderRefFormat(order.id)}`;
  const dateStr = `Date: ${formatReceiptDate(order.created_at)}`;
  
  // Left Box
  doc.setDrawColor(100, 100, 100);
  doc.rect(14, 65, 80, 8);
  doc.text(receiptNoStr, 16, 70);

  // Right Box
  doc.rect(pageWidth - 64, 65, 50, 8);
  doc.text(dateStr, pageWidth - 62, 70);

  // 5. Student Details List
  const detailYStart = 82;
  const lineSpace = 6;
  doc.setFont('helvetica', 'bold');
  
  const studentDetails = [
    { label: "Student Name", value: order.user_name || user?.name || "REVA Student" },
    { label: "Program Name", value: order.user_program || user?.program || "N/A" },
    { label: "Order Name", value: order.file_name || "Unknown Model" }
  ];

  studentDetails.forEach((detail, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(detail.label, 14, detailYStart + i * lineSpace);
    doc.text(":", 55, detailYStart + i * lineSpace);
    doc.setFont('helvetica', 'normal');
    doc.text(detail.value, 60, detailYStart + i * lineSpace);
  });

  // 6. Specification Table (Sl.No | Particulars | Details)
  const tableData = [
    ['1', 'Material', order.material || 'PLA'],
    ['2', 'Infill Density', `${order.infill || 15}%`],
    ['3', 'Layer Height', `${order.layer_height || '0.2'}mm`],
    ['4', 'Supports', order.supports ? 'Required' : 'None'],
    ['5', 'Color Preference', order.color || 'Standard'],
  ];
  if (order.volume) tableData.push([`${tableData.length + 1}`, 'Estimated Volume', `${Math.round(order.volume)} cm³`]);
  if (order.weight) tableData.push([`${tableData.length + 1}`, 'Estimated Weight', `${Math.round(order.weight)} g`]);

  autoTable(doc, {
    startY: detailYStart + studentDetails.length * lineSpace + 5,
    head: [['Sl.No', 'Particulars', 'Description']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [234, 115, 33], textColor: 255, halign: 'center' }, // Orange Header
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 80 },
      2: { cellWidth: 'auto' }
    },
    alternateRowStyles: { fillColor: [250, 240, 235] }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 140;

  // 7. Total Row
  doc.setFillColor(240, 210, 190);
  doc.rect(14, finalY, pageWidth - 28, 8, 'F');
  doc.setDrawColor(0,0,0);
  doc.line(14, finalY, pageWidth - 14, finalY); // Top Line
  doc.line(14, finalY + 8, pageWidth - 14, finalY + 8); // Bottom Line
  
  doc.setFont('helvetica', 'bold');
  doc.text("Total Amount (INR)", 14 + 20 + 80 - 40, finalY + 5.5); // align it
  doc.text(`INR ${order.cost || 0}.00`, 14 + 20 + 80 + 5, finalY + 5.5);

  // 8. Footer Payment Details
  const footerY = finalY + 16;
  const fLineSpace = 8;
  
  // Extract transaction ID from mapped payment_method
  let txnId = "N/A";
  if (order.payment_method?.startsWith("Online: ")) {
    txnId = order.payment_method.replace("Online: ", "");
  }

  const footerDetails = [
    { label: "Amount in Words", value: `Rupees ${numberToWords(order.cost || 0)} Only.` },
    { label: "Mode of Payment", value: order.payment_method?.startsWith("Online") ? "Online - Razorpay" : (order.payment_method || "N/A") },
    { label: "Transaction Id", value: txnId },
    { label: "Transaction Status", value: (order.payment_status === 'paid' || order.status === 'Paid') ? "Success" : "Pending" }
  ];

  footerDetails.forEach((detail, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(detail.label, 14, footerY + i * fLineSpace);
    doc.text(":", 55, footerY + i * fLineSpace);
    doc.setFont('helvetica', 'normal');
    doc.text(detail.value, 60, footerY + i * fLineSpace);
  });

  // Save the document
  doc.save(`Receipt_RU_${order.id?.slice(0, 5) || "IDEA"}.pdf`);
};

// Utils
function orderRefFormat(id?: string) {
  if (!id) return "RU/3DP/N/A";
  return `RU/3DP/${new Date().getFullYear()}/${id.slice(0, 8).toUpperCase()}`;
}

function formatReceiptDate(dateString?: string) {
  if (!dateString) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).replace(/ /g, '-');
}
