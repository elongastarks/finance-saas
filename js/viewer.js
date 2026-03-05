import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";


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
// PAGINATION (OPTIMISATION)
// =========================================

let lastDoc = null;
const PAGE_SIZE = 50;

async function fetchCollection(col, startDate) {
    let q = query(
        collection(db, col),
        where(col === "finances" ? "createdAt" : "soldAt", ">=", startDate)
    );

    if (lastDoc) {
        q = query(q, startAfter(lastDoc));
    }

    const snap = await getDocs(q);

    lastDoc = snap.docs[snap.docs.length - 1] || null;

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

    const startDate = getDateRange(range);

    try {
        // FINANCES
        const financeSnap = await fetchCollection("finances", startDate);

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


        // VENTES
        const venteSnap = await fetchCollection("ventes", startDate);

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


    // CALCULS
    const benefice = stats.entree - stats.sortie;


    // UPDATE UI
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


    // MODULES
    updateChart(stats.history);
    updateAnalysis(stats);
    checkAlerts(stats);

}


// =========================================
// CHART (EVOLUTION - HISTORIQUE 30 JOURS)
// =========================================

let chart;

function updateChart(history) {
    const ctx = document.getElementById("viewerChart").getContext("2d");

    if (chart) chart.destroy();

    history.sort((a, b) => a.date - b.date);

    const labels = history.map(h => h.date.toLocaleDateString());
    const data = history.map(h => h.value);

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
                legend: {
                    display: true
                }
            }
        }
    });
}


// =========================================
// ANALYTICS MESSAGE
// =========================================

function updateAnalysis(stats) {
    const analysis = document.getElementById("analysis-text");

    const benefice = stats.entree - stats.sortie;

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
// ALERTES INTELLIGENTES
// =========================================

function checkAlerts(stats) {
    const analysis = document.getElementById("analysis-text");

    let alerts = [];

    if (stats.entree < stats.sortie) {
        alerts.push("Perte détectée");
    }

    if (stats.stock < 10) {
        alerts.push("Stock critique");
    }

    if (stats.ventes === 0) {
        alerts.push("Aucune vente sur la période");
    }

    if (alerts.length) {
        analysis.textContent += " | ALERTES: " + alerts.join(", ");
    }
}


// =========================================
// EXPORT CSV
// =========================================

function exportCSV(history) {
    let csv = "date,type,valeur\n";

    history.forEach(h => {
        csv += `${h.date.toISOString()},${h.type},${h.value}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "export.csv";
    a.click();

    URL.revokeObjectURL(url);
}


// =========================================
// FILTRE
// =========================================

document.querySelectorAll(".filter-buttons button").forEach(btn => {
    btn.addEventListener("click", () => {
        const range = parseInt(btn.getAttribute("data-range"));
        loadViewer(range);
    });
});


// =========================================
// EXPORT BUTTON (OPTION)
 // =========================================

document.getElementById("export-btn")?.addEventListener("click", async () => {
    const startDate = getDateRange(30);

    let history = [];

    try {
        const financeSnap = await getDocs(query(
            collection(db, "finances"),
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

        const venteSnap = await getDocs(query(
            collection(db, "ventes"),
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
// INIT
// =========================================

loadViewer();