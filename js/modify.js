import { db } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
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
    }, 4000);
}


// =========================================
// VARIABLES
// =========================================

let currentDocId = null;
let currentCollection = null;


// =========================================
// RECHERCHE DOCUMENT
// =========================================

document.getElementById("search-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("docId").value.trim();
    const collectionName = document.getElementById("collection").value;

    if (!id) return showMessage("ID obligatoire", "error");
    if (!collectionName) return showMessage("Sélectionnez une collection", "error");

    try {
        const ref = doc(db, collectionName, id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            return showMessage("Document introuvable", "error");
        }

        currentDocId = id;
        currentCollection = collectionName;

        showEditForm(snap.data());

    } catch (e) {
        console.warn(e);
        showMessage("Erreur de recherche", "error");
    }
});


// =========================================
// AFFICHER FORMULAIRE DYNAMIQUE
// =========================================

function showEditForm(data) {
    const container = document.getElementById("dynamic-fields");
    container.innerHTML = "";

    document.getElementById("edit-section").style.display = "block";

    if (currentCollection === "finances") {
        container.innerHTML = financeFields(data);
    } else {
        container.innerHTML = venteFields(data);
    }
}


// FINANCE FIELDS
function financeFields(data) {
    return `
<label>Titre</label>
<input type="text" id="title" value="${data.title || ""}" required>

<label>Type</label>
<select id="type" required>
<option value="income" ${data.type === "income" ? "selected" : ""}>Entrée</option>
<option value="expense" ${data.type === "expense" ? "selected" : ""}>Sortie</option>
</select>

<label>Catégorie</label>
<input type="text" id="category" value="${data.category || ""}" required>

<label>Montant</label>
<input type="number" id="amount" value="${data.amount || 0}" required>

<label>Devise</label>
<select id="currency">
<option value="USD" ${data.currency === "USD" ? "selected" : ""}>USD</option>
<option value="CDF" ${data.currency === "CDF" ? "selected" : ""}>CDF</option>
</select>

<label>Description</label>
<textarea id="description">${data.description || ""}</textarea>

<label>Lien reçu</label>
<input type="text" id="receiptUrl" value="${data.receiptUrl || ""}">

<label>Statut</label>
<select id="status">
<option value="pending" ${data.status === "pending" ? "selected" : ""}>En attente</option>
<option value="validated" ${data.status === "validated" ? "selected" : ""}>Validé</option>
</select>
`;
}


// VENTE FIELDS
function venteFields(data) {
    return `
<label>Produit</label>
<input type="text" id="productName" value="${data.productName || ""}" required>

<label>Catégorie</label>
<input type="text" id="productCategory" value="${data.productCategory || ""}" required>

<label>Prix unitaire</label>
<input type="number" id="productPrice" value="${data.productPrice || 0}" required>

<label>Quantité</label>
<input type="number" id="quantity" value="${data.quantity || 0}" required>

<label>Devise</label>
<select id="currency">
<option value="USD" ${data.currency === "USD" ? "selected" : ""}>USD</option>
<option value="CDF" ${data.currency === "CDF" ? "selected" : ""}>CDF</option>
</select>

<label>Client</label>
<input type="text" id="buyerName" value="${data.buyerName || ""}">

<label>Téléphone</label>
<input type="text" id="buyerPhone" value="${data.buyerPhone || ""}">

<label>Paiement</label>
<select id="paymentMethod">
<option value="cash" ${data.paymentMethod === "cash" ? "selected" : ""}>Cash</option>
<option value="mobile" ${data.paymentMethod === "mobile" ? "selected" : ""}>Mobile</option>
<option value="transfer" ${data.paymentMethod === "transfer" ? "selected" : ""}>Transfert</option>
</select>

<label>Statut</label>
<select id="status">
<option value="pending" ${data.status === "pending" ? "selected" : ""}>En attente</option>
<option value="paid" ${data.status === "paid" ? "selected" : ""}>Payé</option>
</select>

<label>Notes</label>
<textarea id="notes">${data.notes || ""}</textarea>
`;
}


// =========================================
// VALIDATION
// =========================================

function validateFinance(data) {
    if (!data.title) return "Titre obligatoire";
    if (!data.type) return "Type obligatoire";
    if (!data.category) return "Catégorie obligatoire";
    if (!data.amount || data.amount <= 0) return "Montant invalide";
    return null;
}

function validateVente(data) {
    if (!data.productName) return "Produit obligatoire";
    if (!data.productCategory) return "Catégorie obligatoire";
    if (!data.productPrice || data.productPrice <= 0) return "Prix invalide";
    if (!data.quantity || data.quantity <= 0) return "Quantité invalide";
    return null;
}


// =========================================
// ENREGISTRER MODIFICATION
// =========================================

document.getElementById("edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentDocId || !currentCollection) {
        return showMessage("Aucun document chargé", "error");
    }

    let data = {};

    if (currentCollection === "finances") {
        data = {
            title: document.getElementById("title").value.trim(),
            type: document.getElementById("type").value,
            category: document.getElementById("category").value.trim(),
            amount: Number(document.getElementById("amount").value),
            currency: document.getElementById("currency").value,
            description: document.getElementById("description").value.trim(),
            receiptUrl: document.getElementById("receiptUrl").value.trim(),
            status: document.getElementById("status").value,
            updatedAt: serverTimestamp()
        };

        const error = validateFinance(data);
        if (error) return showMessage(error, "error");
    }

    if (currentCollection === "ventes") {
        data = {
            productName: document.getElementById("productName").value.trim(),
            productCategory: document.getElementById("productCategory").value.trim(),
            productPrice: Number(document.getElementById("productPrice").value),
            quantity: Number(document.getElementById("quantity").value),
            totalPrice: Number(document.getElementById("productPrice").value) * Number(document.getElementById("quantity").value),
            currency: document.getElementById("currency").value,
            buyerName: document.getElementById("buyerName").value.trim(),
            buyerPhone: document.getElementById("buyerPhone").value.trim(),
            paymentMethod: document.getElementById("paymentMethod").value,
            status: document.getElementById("status").value,
            notes: document.getElementById("notes").value.trim(),
            updatedAt: serverTimestamp()
        };

        const error = validateVente(data);
        if (error) return showMessage(error, "error");
    }

    try {
        const ref = doc(db, currentCollection, currentDocId);
        await updateDoc(ref, data);

        showMessage("Modification enregistrée");
    } catch (e) {
        console.warn(e);
        showMessage("Erreur de mise à jour (offline possible)", "error");
    }
});