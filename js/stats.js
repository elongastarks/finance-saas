import { db } from "./firebase.js";

import {
collection,
getDocs,
query,
where
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";


// =========================================
// CALCUL DATE RANGE
// =========================================

function getDateRange(days){

const now = new Date();

const past = new Date();

past.setDate(now.getDate() - days);

return past;

}



// =========================================
// STATS LOGIC (FINANCES + VENTES)
// =========================================

async function loadStats(range = 7){

let stats = {

entree: 0,
sortie: 0,
stock: 0,
ventes: 0,
countFinances: 0,
countVentes: 0

};


const startDate = getDateRange(range);


try{


// =========================================
// FINANCES QUERY
// =========================================

const financesQuery = query(

collection(db,"finances"),

where("createdAt",">=",startDate)

);


const financesSnap = await getDocs(financesQuery);


financesSnap.forEach(doc=>{

const data = doc.data();

if(data.type === "income"){
stats.entree += data.amount || 0;
}

if(data.type === "expense"){
stats.sortie += data.amount || 0;
}

stats.countFinances++;

});



// =========================================
// VENTES QUERY
// =========================================

const ventesQuery = query(

collection(db,"ventes"),

where("soldAt",">=",startDate)

);


const ventesSnap = await getDocs(ventesQuery);


ventesSnap.forEach(doc=>{

const data = doc.data();

stats.ventes += data.totalPrice || 0;

stats.stock += data.quantity || 0;

stats.countVentes++;

});


}catch(e){

console.warn("Offline mode or error",e);

}



// =========================================
// BENEFICE
// =========================================

const benefice = stats.entree - stats.sortie;



// =========================================
// UI UPDATE
// =========================================

document.getElementById("total-entree").textContent =
formatMoney(stats.entree);

document.getElementById("total-sortie").textContent =
formatMoney(stats.sortie);

document.getElementById("benefice").textContent =
formatMoney(benefice);

document.getElementById("stock").textContent =
stats.stock;



// modules dashboard

updateTrend(stats);
updateAlerts(stats);
updateChart(stats);
updateAnalysis(stats);

}



// =========================================
// FORMAT MONEY
// =========================================

function formatMoney(value){

return value.toLocaleString();

}



// =========================================
// TREND
// =========================================

function updateTrend(stats){

const trendText =
document.getElementById("trend-text");


const previous =
stats.entree * 0.8;


let text = "↔ stable";


if(previous > 0){

const diff =
((stats.entree - previous) / previous) * 100;

if(diff > 0){
text = `↗️ +${diff.toFixed(1)}%`;
}

else if(diff < 0){
text = `↘️ ${diff.toFixed(1)}%`;
}

}


trendText.textContent = text;

}



// =========================================
// ALERTS
// =========================================

function updateAlerts(stats){

const alert =
document.getElementById("alert-text");

let messages = [];


if(stats.entree < stats.sortie){
messages.push("Perte détectée");
}


if(stats.stock < 10){
messages.push("Stock faible");
}


alert.textContent =
messages.length
? messages.join(" | ")
: "Aucune alerte";

}



// =========================================
// CHART
// =========================================

let chart;

function updateChart(stats){

const ctx =
document.getElementById("financeChart").getContext("2d");


if(chart) chart.destroy();


chart = new Chart(ctx,{

type:"bar",

data:{

labels:[
"Entrées",
"Sorties",
"Ventes"
],

datasets:[{

label:"Montants",

data:[
stats.entree,
stats.sortie,
stats.ventes
],

borderWidth:1

}]

},

options:{

responsive:true,

plugins:{
legend:{
display:false
}
}

}

});

}



// =========================================
// ANALYTICS
// =========================================

function updateAnalysis(stats){

const analysis =
document.getElementById("analysis-text");


const benefice =
stats.entree - stats.sortie;


let text="";


if(benefice > 0){

text =
"Votre gestion financière est positive. Les revenus dépassent les dépenses.";

}else{

text =
"Attention : vos dépenses dépassent les entrées. Réduisez les coûts.";

}


if(stats.ventes > stats.entree){

text +=
" Les ventes représentent une source importante de revenus.";

}


analysis.textContent = text;

}



// =========================================
// FILTRES
// =========================================

document
.querySelectorAll(".filter-buttons button")
.forEach(btn=>{

btn.addEventListener("click",()=>{

const range =
parseInt(btn.getAttribute("data-range"));

loadStats(range);

});

});



// =========================================
// INIT
// =========================================

loadStats();