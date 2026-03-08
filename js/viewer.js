import { db } from "./firebase.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    startAfter,
    limit,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const auth = getAuth();
const PAGE_SIZE = 50;

let lastDocFinances = null;
let lastDocVentes = null;


// =========================================
// MESSAGE UX
// =========================================

function showMessage(text, type = "success") {
    const msg = document.getElementById("message");

    if (!msg) return;

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
    const past = new Date();
    past.setDate(new Date().getDate() - days);
    return past;
}


// =========================================
// FORMAT MONEY
// =========================================

function formatMoney(value) {
    return value.toLocaleString();
}


// =========================================
// PAGINATION (FIRESTORE OPTIMISÉ)
// =========================================

async function fetchPage(col, startDate) {

    const user = auth.currentUser;

    if (!user) return [];

    const dateField =
        col === "finances" ? "createdAt" : "soldAt";

    let q = query(
        collection(db, col),
        where("userID", "==", user.uid),
        where(dateField, ">=", startDate),
        orderBy(dateField),
        limit(PAGE_SIZE)
    );

    const lastDoc =
        col === "finances"
            ? lastDocFinances
            : lastDocVentes;

    if (lastDoc) {
        q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);

    const newLastDoc =
        snap.docs[snap.docs.length - 1] || null;

    if (col === "finances") {
        lastDocFinances = newLastDoc;
    } else {
        lastDocVentes = newLastDoc;
    }

    return snap;
}


// =========================================
// LOAD DATA (HISTORIQUE + STATS)
// =========================================

async function loadViewer(range = 30) {

    let stats = {
        entree: 0,
        sortie: 0,
        ventes: 0,
        stock: 0,
        history: []
    };

    const startDate =
        Timestamp.fromDate(getDateRange(range));

    try {

        // =========================================
        // FINANCES
        // =========================================

        const financeSnap =
            await fetchPage("finances", startDate);

        financeSnap.forEach(doc => {

            const data = doc.data();

            if (data.type === "income") {
                stats.entree += data.amount || 0;
            }

            if (data.type === "expense") {
                stats.sortie += data.amount || 0;
            }

            stats.history.push({
                date: data.createdAt?.toDate?.() || new Date(),
                value: data.amount || 0,
                type: data.type
            });

        });


        // =========================================
        // VENTES
        // =========================================

        const venteSnap =
            await fetchPage("ventes", startDate);

        venteSnap.forEach(doc => {

            const data = doc.data();

            stats.ventes += data.totalPrice || 0;
            stats.stock += data.quantity || 0;

            stats.history.push({
                date: data.soldAt?.toDate?.() || new Date(),
                value: data.totalPrice || 0,
                type: "vente"
            });

        });

    } catch (e) {

        console.warn("offline or query error", e);

    }


    // =========================================
    // CALCULS
    // =========================================

    const benefice =
        stats.entree - stats.sortie;


    // =========================================
    // UPDATE UI
    // =========================================

    document.getElementById("stat-entree").textContent =
        formatMoney(stats.entree);

    document.getElementById("stat-sortie").textContent =
        formatMoney(stats.sortie);

    document.getElementById("stat-benefice").textContent =
        formatMoney(benefice);

    document.getElementById("stat-ventes").textContent =
        formatMoney(stats.ventes);

    document.getElementById("stat-stock").textContent =
        stats.stock;


    // =========================================
    // MODULES
    // =========================================

    updateChart(stats.history);
    updateAnalysis(stats);
    checkAlerts(stats);

}


// =========================================
// CHART (EVOLUTION)
// =========================================

let chart;

function updateChart(history) {

    const ctx =
        document.getElementById("viewerChart")
        ?.getContext("2d");

    if (!ctx) return;

    if (chart) chart.destroy();

    history.sort((a, b) => a.date - b.date);

    const labels =
        history.map(h =>
            h.date.toLocaleDateString()
        );

    const data =
        history.map(h => h.value);

    chart = new Chart(ctx, {

        type: "line",

        data: {

            labels,

            datasets: [{
                label: "Évolution",
                data,
                borderWidth: 2,
                fill: false
            }]

        },

        options: {

            responsive: true,

            plugins: {
                legend: { display: true }
            }

        }

    });

}


// =========================================
// ANALYTICS
// =========================================

function updateAnalysis(stats) {

    const analysis =
        document.getElementById("analysis-text");

    if (!analysis) return;

    const benefice =
        stats.entree - stats.sortie;

    let message = "";

    if (benefice > 0) {

        message =
            "Performance positive. Les revenus dépassent les dépenses.";

    } else {

        message =
            "Attention : les dépenses dépassent les revenus.";

    }

    if (stats.ventes > stats.entree) {

        message +=
            " Les ventes représentent une source importante de revenus.";

    }

    if (stats.stock < 10) {

        message +=
            " Stock faible : pensez à réapprovisionner.";

    }

    analysis.textContent = message;

}


// =========================================
// ALERTES
// =========================================

function checkAlerts(stats) {

    const analysis =
        document.getElementById("analysis-text");

    if (!analysis) return;

    let alerts = [];

    if (stats.entree < stats.sortie)
        alerts.push("Perte détectée");

    if (stats.stock < 10)
        alerts.push("Stock critique");

    if (stats.ventes === 0)
        alerts.push("Aucune vente sur la période");

    if (alerts.length) {

        analysis.textContent +=
            " | ALERTES: " + alerts.join(", ");

    }

}


// =========================================
// EXPORT CSV
// =========================================

function exportCSV(history) {

    let csv =
        "date,type,valeur\n";

    history.forEach(h => {

        csv +=
            `${h.date.toISOString()},${h.type},${h.value}\n`;

    });

    const blob =
        new Blob([csv], { type: "text/csv" });

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;
    a.download = "export.csv";
    a.click();

    URL.revokeObjectURL(url);

}


// =========================================
// FILTRES
// =========================================

document
.querySelectorAll(".filter-buttons button")
.forEach(btn => {

    btn.addEventListener("click", () => {

        const range =
            parseInt(
                btn.getAttribute("data-range")
            );

        loadViewer(range);

    });

});


// =========================================
// EXPORT BUTTON
// =========================================

document
.getElementById("export-btn")
?.addEventListener("click", async () => {

    const user = auth.currentUser;

    if (!user) {
        showMessage("Utilisateur non connecté", "error");
        return;
    }

    const startDate =
        Timestamp.fromDate(getDateRange(30));

    let history = [];

    try {

        const financeSnap =
            await getDocs(query(

                collection(db, "finances"),

                where("userID", "==", user.uid),
                where("createdAt", ">=", startDate)

            ));

        financeSnap.forEach(doc => {

            const data = doc.data();

            history.push({

                date: data.createdAt?.toDate?.() || new Date(),
                type: data.type,
                value: data.amount || 0

            });

        });

        const venteSnap =
            await getDocs(query(

                collection(db, "ventes"),

                where("userID", "==", user.uid),
                where("soldAt", ">=", startDate)

            ));

        venteSnap.forEach(doc => {

            const data = doc.data();

            history.push({

                date: data.soldAt?.toDate?.() || new Date(),
                type: "vente",
                value: data.totalPrice || 0

            });

        });

        exportCSV(history);

    } catch (e) {

        console.warn(e);
        showMessage("Erreur d'export", "error");

    }

});


// =========================================
// INIT (ATTEND FIREBASE AUTH)
// =========================================

onAuthStateChanged(auth, (user) => {

    if (user) {

        loadViewer();

    } else {

        showMessage("Utilisateur non connecté", "error");

    }

});