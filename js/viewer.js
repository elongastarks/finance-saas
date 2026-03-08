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

let chartUSD;
let chartCDF;

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
},3500);

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

function formatMoney(value){

return value.toLocaleString();

}

// =========================================
// PAGINATION FIRESTORE
// =========================================

async function fetchPage(col,startDate){

const user = auth.currentUser;
if(!user) return [];

const dateField = col === "finances" ? "createdAt" : "soldAt";

let q = query(
collection(db,col),
where("userID","==",user.uid),
where(dateField,">=",startDate),
orderBy(dateField),
limit(PAGE_SIZE)
);

const lastDoc = col === "finances"
? lastDocFinances
: lastDocVentes;

if(lastDoc){

q = query(q,startAfter(lastDoc));

}

const snap = await getDocs(q);

const newLastDoc = snap.docs[snap.docs.length-1] || null;

if(col === "finances"){
lastDocFinances = newLastDoc;
}else{
lastDocVentes = newLastDoc;
}

return snap;

}

// =========================================
// LOAD VIEWER
// =========================================

async function loadViewer(range = 30){

let stats = {

usd:{
entree:0,
sortie:0,
ventes:0,
stock:0,
history:[]
},

cdf:{
entree:0,
sortie:0,
ventes:0,
stock:0,
history:[]
}

};

const startDate = Timestamp.fromDate(getDateRange(range));

try{

// =========================================
// FINANCES
// =========================================

const financeSnap = await fetchPage("finances",startDate);

financeSnap.forEach(doc=>{

const data = doc.data();

const currency = (data.currency || "USD").toLowerCase();

const target = stats[currency];

if(!target) return;

if(data.type === "income"){
target.entree += data.amount || 0;
}

if(data.type === "expense"){
target.sortie += data.amount || 0;
}

target.history.push({

date: data.createdAt?.toDate?.() || new Date(),
value: data.amount || 0,
type: data.type

});

});


// =========================================
// VENTES
// =========================================

const venteSnap = await fetchPage("ventes",startDate);

venteSnap.forEach(doc=>{

const data = doc.data();

const currency = (data.currency || "USD").toLowerCase();

const target = stats[currency];

if(!target) return;

target.ventes += data.totalPrice || 0;
target.stock += data.quantity || 0;

target.history.push({

date: data.soldAt?.toDate?.() || new Date(),
value: data.totalPrice || 0,
type: "vente"

});

});

}catch(e){

console.warn("offline or query error",e);

}

// =========================================
// CALCULS
// =========================================

const benefUSD = stats.usd.entree - stats.usd.sortie;
const benefCDF = stats.cdf.entree - stats.cdf.sortie;

// =========================================
// UPDATE UI
// =========================================

document.getElementById("usd-entree").textContent = formatMoney(stats.usd.entree);
document.getElementById("usd-sortie").textContent = formatMoney(stats.usd.sortie);
document.getElementById("usd-benefice").textContent = formatMoney(benefUSD);
document.getElementById("usd-ventes").textContent = formatMoney(stats.usd.ventes);
document.getElementById("usd-stock").textContent = stats.usd.stock;

document.getElementById("cdf-entree").textContent = formatMoney(stats.cdf.entree);
document.getElementById("cdf-sortie").textContent = formatMoney(stats.cdf.sortie);
document.getElementById("cdf-benefice").textContent = formatMoney(benefCDF);
document.getElementById("cdf-ventes").textContent = formatMoney(stats.cdf.ventes);
document.getElementById("cdf-stock").textContent = stats.cdf.stock;

// =========================================
// MODULES
// =========================================

updateChart(stats.usd.history,"chartUSD","USD");
updateChart(stats.cdf.history,"chartCDF","CDF");

updateAnalysis(stats);
checkAlerts(stats);

}

// =========================================
// CHART
// =========================================

function updateChart(history,canvasID,label){

const ctx = document.getElementById(canvasID)?.getContext("2d");

if(!ctx) return;

history.sort((a,b)=>a.date-b.date);

const labels = history.map(h=>h.date.toLocaleDateString());
const data = history.map(h=>h.value);

if(canvasID === "chartUSD" && chartUSD){
chartUSD.destroy();
}

if(canvasID === "chartCDF" && chartCDF){
chartCDF.destroy();
}

const newChart = new Chart(ctx,{

type:"line",

data:{
labels,
datasets:[{
label:`Evolution ${label}`,
data,
borderWidth:2,
fill:false
}]
},

options:{
responsive:true,
plugins:{
legend:{display:true}
}
}

});

if(canvasID === "chartUSD"){
chartUSD = newChart;
}else{
chartCDF = newChart;
}

}

// =========================================
// ANALYTICS
// =========================================

function updateAnalysis(stats){

const analysis = document.getElementById("analysis-text");
if(!analysis) return;

let message = "";

const benef = (stats.usd.entree + stats.cdf.entree)
-
(stats.usd.sortie + stats.cdf.sortie);

if(benef > 0){

message = "Performance positive. Les revenus dépassent les dépenses.";

}else{

message = "Attention : les dépenses dépassent les revenus.";

}

if(stats.usd.stock + stats.cdf.stock < 10){

message += " Stock faible : pensez à réapprovisionner.";

}

analysis.textContent = message;

}

// =========================================
// ALERTES
// =========================================

function checkAlerts(stats){

const analysis = document.getElementById("analysis-text");
if(!analysis) return;

let alerts = [];

if((stats.usd.entree + stats.cdf.entree) < (stats.usd.sortie + stats.cdf.sortie))
alerts.push("Perte détectée");

if(stats.usd.stock + stats.cdf.stock < 10)
alerts.push("Stock critique");

if(stats.usd.ventes + stats.cdf.ventes === 0)
alerts.push("Aucune vente sur la période");

if(alerts.length){

analysis.textContent += " | ALERTES: " + alerts.join(", ");

}

}

// =========================================
// EXPORT CSV
// =========================================

function exportCSV(history){

let csv = "date,type,valeur\n";

history.forEach(h=>{

csv += `${h.date.toISOString()},${h.type},${h.value}\n`;

});

const blob = new Blob([csv],{type:"text/csv"});

const url = URL.createObjectURL(blob);

const a = document.createElement("a");

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
.forEach(btn=>{

btn.addEventListener("click",()=>{

const range = parseInt(btn.getAttribute("data-range"));
loadViewer(range);

});

});

// =========================================
// INIT
// =========================================

onAuthStateChanged(auth,(user)=>{

if(user){

loadViewer();

}else{

showMessage("Utilisateur non connecté","error");

}

});