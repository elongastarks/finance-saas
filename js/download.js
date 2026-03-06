import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


const auth = getAuth();


// =========================================
// MESSAGE UX
// =========================================

function showMessage(text, type = "success") {
    const msg = document.getElementById("message");
    msg.textContent = text;
    msg.className = `message ${type}`;
    msg.style.display = "block";

    setTimeout(() => {
        msg.style.display = "none";
    }, 3500);
}


// =========================================
// DATE RANGE
// =========================================

function getDateRange(days) {
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - days);
    return past;
}


// =========================================
// FORMAT MONEY
// =========================================

function formatMoney(value) {
    return value.toLocaleString();
}


// =========================================
// FETCH DATA (FIRESTORE + USER FILTER)
// =========================================

async function fetchData(type, range) {
    const startDate = getDateRange(range);
    let rows = [];

    if (!auth.currentUser) {
        showMessage("Connectez-vous", "error");
        return rows;
    }

    const uid = auth.currentUser.uid;

    try {
        if (type === "finances") {
            const snap = await getDocs(query(
                collection(db, "finances"),
                where("userID", "==", uid),
                where("createdAt", ">=", startDate)
            ));

            snap.forEach(doc => {
                const d = doc.data();
                rows.push({
                    title: d.title || "",
                    type: d.type || "",
                    category: d.category || "",
                    amount: d.amount || 0,
                    currency: d.currency || "",
                    description: d.description || "",
                    status: d.status || "",
                    createdAt: d.createdAt?.toDate?.() || new Date()
                });
            });
        }

        if (type === "ventes") {
            const snap = await getDocs(query(
                collection(db, "ventes"),
                where("userID", "==", uid),
                where("soldAt", ">=", startDate)
            ));

            snap.forEach(doc => {
                const d = doc.data();
                rows.push({
                    productName: d.productName || "",
                    category: d.productCategory || "",
                    price: d.productPrice || 0,
                    quantity: d.quantity || 0,
                    total: d.totalPrice || 0,
                    currency: d.currency || "",
                    buyer: d.buyerName || "",
                    payment: d.paymentMethod || "",
                    status: d.status || "",
                    date: d.soldAt?.toDate?.() || new Date()
                });
            });
        }

    } catch (e) {
        console.warn(e);
        showMessage("Erreur de récupération", "error");
    }

    return rows;
}


// =========================================
// PREVIEW TABLE
// =========================================

function renderPreview(rows, type) {
    const container = document.getElementById("preview-table");

    if (!rows.length) {
        container.innerHTML = "<p>Aucune donnée</p>";
        return;
    }

    let html = "<table><thead><tr>";

    if (type === "finances") {
        html += `
            <th>Titre</th>
            <th>Type</th>
            <th>Catégorie</th>
            <th>Montant</th>
            <th>Devise</th>
            <th>Description</th>
            <th>Statut</th>
            <th>Date</th>
        `;
    } else {
        html += `
            <th>Produit</th>
            <th>Catégorie</th>
            <th>Prix</th>
            <th>Quantité</th>
            <th>Total</th>
            <th>Client</th>
            <th>Paiement</th>
            <th>Statut</th>
            <th>Date</th>
        `;
    }

    html += "</tr></thead><tbody>";

    rows.forEach(r => {
        html += "<tr>";

        if (type === "finances") {
            html += `
                <td>${r.title}</td>
                <td>${r.type}</td>
                <td>${r.category}</td>
                <td>${formatMoney(r.amount)}</td>
                <td>${r.currency}</td>
                <td>${r.description}</td>
                <td>${r.status}</td>
                <td>${r.createdAt.toLocaleDateString()}</td>
            `;
        } else {
            html += `
                <td>${r.productName}</td>
                <td>${r.category}</td>
                <td>${formatMoney(r.price)}</td>
                <td>${r.quantity}</td>
                <td>${formatMoney(r.total)}</td>
                <td>${r.buyer}</td>
                <td>${r.payment}</td>
                <td>${r.status}</td>
                <td>${r.date.toLocaleDateString()}</td>
            `;
        }

        html += "</tr>";
    });

    html += "</tbody></table>";
    container.innerHTML = html;
}


// =========================================
// EXPORT PDF
// =========================================

async function exportPDF(rows, type) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Export Finances Pro", 14, 10);

    let columns;
    let body = [];

    if (type === "finances") {
        columns = [
            "Titre",
            "Type",
            "Catégorie",
            "Montant",
            "Devise",
            "Description",
            "Statut",
            "Date"
        ];

        rows.forEach(r => {
            body.push([
                r.title,
                r.type,
                r.category,
                formatMoney(r.amount),
                r.currency,
                r.description,
                r.status,
                r.createdAt.toLocaleDateString()
            ]);
        });
    } else {
        columns = [
            "Produit",
            "Catégorie",
            "Prix",
            "Quantité",
            "Total",
            "Client",
            "Paiement",
            "Statut",
            "Date"
        ];

        rows.forEach(r => {
            body.push([
                r.productName,
                r.category,
                formatMoney(r.price),
                r.quantity,
                formatMoney(r.total),
                r.buyer,
                r.payment,
                r.status,
                r.date.toLocaleDateString()
            ]);
        });
    }

    doc.autoTable({
        head: [columns],
        body,
        styles: {
            cellWidth: "wrap",
            overflow: "linebreak"
        }
    });

    doc.save("export.pdf");
}


// =========================================
// EXPORT CSV
// =========================================

function exportCSV(rows, type) {
    let csv = "";

    if (type === "finances") {
        csv = "titre,type,catégorie,montant,devise,description,statut,date\n";
        rows.forEach(r => {
            csv += `${r.title},${r.type},${r.category},${r.amount},${r.currency},${r.description},${r.status},${r.createdAt.toISOString()}\n`;
        });
    } else {
        csv = "produit,catégorie,prix,quantité,total,client,paiement,statut,date\n";
        rows.forEach(r => {
            csv += `${r.productName},${r.category},${r.price},${r.quantity},${r.total},${r.buyer},${r.payment},${r.status},${r.date.toISOString()}\n`;
        });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "export.csv";
    a.click();

    URL.revokeObjectURL(url);
}


// =========================================
// EXPORT HANDLER
// =========================================

document.getElementById("export-btn").addEventListener("click", async () => {
    const type = document.getElementById("export-type").value;
    const range = parseInt(document.getElementById("export-range").value);
    const format = document.getElementById("export-format").value;

    const rows = await fetchData(type, range);

    if (!rows.length) {
        return showMessage("Aucune donnée à exporter", "error");
    }

    renderPreview(rows, type);

    if (format === "pdf") {
        exportPDF(rows, type);
    } else {
        exportCSV(rows, type);
    }

    showMessage("Export réussi");
});


// =========================================
// INIT PREVIEW
// =========================================

document.getElementById("export-type").addEventListener("change", async () => {
    const type = document.getElementById("export-type").value;
    const range = parseInt(document.getElementById("export-range").value);

    const rows = await fetchData(type, range);
    renderPreview(rows, type);
});