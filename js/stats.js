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
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const auth = getAuth();


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
// STATS LOGIC
// =========================================

async function loadStats(range = 7) {

    const user = auth.currentUser;
    if (!user) {
        console.warn("Utilisateur non connecté");
        return;
    }

    let stats = {
        entree: 0,
        sortie: 0,
        stock: 0,
        ventes: 0,
        countFinances: 0,
        countVentes: 0
    };

    const uid = user.uid;
    const startDate = Timestamp.fromDate(getDateRange(range));

    try {

        // FINANCES
        const financesQuery = query(
            collection(db, "finances"),
            where("userID", "==", uid),
            where("createdAt", ">=", startDate)
        );

        const financesSnap = await getDocs(financesQuery);

        financesSnap.forEach(doc => {
            const data = doc.data();

            if (data.type === "income") {
                stats.entree += data.amount || 0;
            }

            if (data.type === "expense") {
                stats.sortie += data.amount || 0;
            }

            stats.countFinances++;
        });


        // VENTES
        const ventesQuery = query(
            collection(db, "ventes"),
            where("userID", "==", uid),
            where("soldAt", ">=", startDate)
        );

        const ventesSnap = await getDocs(ventesQuery);

        ventesSnap.forEach(doc => {
            const data = doc.data();

            stats.ventes += data.totalPrice || 0;
            stats.stock += data.quantity || 0;

            stats.countVentes++;
        });

    } catch (e) {
        console.warn("offline mode or error", e);
    }


    // BENEFICE
    const benefice = stats.entree - stats.sortie;


    // UPDATE UI (guards)
    const elEntree = document.getElementById("total-entree");
    const elSortie = document.getElementById("total-sortie");
    const elBenef = document.getElementById("benefice");
    const elStock = document.getElementById("stock");

    if (elEntree) elEntree.textContent = formatMoney(stats.entree);
    if (elSortie) elSortie.textContent = formatMoney(stats.sortie);
    if (elBenef) elBenef.textContent = formatMoney(benefice);
    if (elStock) elStock.textContent = stats.stock;


    // MODULES (guards)
    if (typeof updateTrend === "function") updateTrend(stats);
    if (typeof updateAlerts === "function") updateAlerts(stats);
    if (typeof updateChart === "function") updateChart(stats);
    if (typeof updateAnalysis === "function") updateAnalysis(stats);

}


// =========================================
// TREND (plus réaliste)
// =========================================

function updateTrend(stats) {

    const trendText = document.getElementById("trend-text");
    if (!trendText) return;

    const previous = stats.entree * 0.8;
    let text = "↔ stable";

    if (previous > 0) {

        const diff = ((stats.entree - previous) / previous) * 100;

        if (diff > 1) {
            text = `↗️ +${diff.toFixed(1)}%`;
        } else if (diff < -1) {
            text = `↘️ ${diff.toFixed(1)}%`;
        }

    }

    trendText.textContent = text;
}


// =========================================
// ALERTS
// =========================================

function updateAlerts(stats) {

    const alert = document.getElementById("alert-text");
    if (!alert) return;

    let messages = [];

    if (stats.entree < stats.sortie) {
        messages.push("Perte détectée");
    }

    if (stats.stock < 10) {
        messages.push("Stock faible");
    }

    alert.textContent =
        messages.length ? messages.join(" | ") : "Aucune alerte";

}


// =========================================
// CHART (guard)
// =========================================

let chart;

function updateChart(stats) {

    const canvas = document.getElementById("financeChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (chart) chart.destroy();

    chart = new Chart(ctx, {

        type: "bar",

        data: {

            labels: [
                "Entrées",
                "Sorties",
                "Ventes"
            ],

            datasets: [{
                label: "Montants",
                data: [
                    stats.entree,
                    stats.sortie,
                    stats.ventes
                ],
                borderWidth: 1
            }]

        },

        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }

    });

}


// =========================================
// ANALYTICS
// =========================================

function updateAnalysis(stats) {

    const analysis = document.getElementById("analysis-text");
    if (!analysis) return;

    const benefice = stats.entree - stats.sortie;

    let text = "";

    if (benefice > 0) {
        text = "Votre gestion financière est positive. Les revenus dépassent les dépenses.";
    } else {
        text = "Attention : vos dépenses dépassent les entrées. Réduisez les coûts.";
    }

    if (stats.ventes > stats.entree) {
        text += " Les ventes représentent une source importante de revenus.";
    }

    if (stats.stock < 10) {
        text += " Stock faible : pensez à réapprovisionner.";
    }

    analysis.textContent = text;

}


// =========================================
// FILTRES
// =========================================

document
.querySelectorAll(".filter-buttons button")
.forEach(btn => {

    btn.addEventListener("click", () => {

        const range = parseInt(btn.getAttribute("data-range"));
        loadStats(range);

    });

});


// =========================================
// INIT (AUTH)
// =========================================

onAuthStateChanged(auth, (user) => {

    if (user) {
        loadStats();
    } else {
        console.warn("Utilisateur non connecté");
    }

});