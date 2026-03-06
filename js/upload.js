import { db } from "./firebase.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

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
    }, 4000);
}


// =========================================
// VALIDATION FINANCE
// =========================================

function validateFinance(data) {
    if (!data.title) return "Le titre est obligatoire";
    if (!data.type) return "Le type est obligatoire";
    if (!data.category) return "La catégorie est obligatoire";
    if (!data.amount || data.amount <= 0) return "Montant invalide";
    if (!data.currency) return "Devise obligatoire";

    return null;
}


// =========================================
// SAVE FINANCE
// =========================================

async function saveFinance(data) {
    if (!auth.currentUser) {
        showMessage("Connectez-vous", "error");
        return false;
    }

    try {
        await addDoc(collection(db, "finances"), {
            title: data.title,
            type: data.type,
            category: data.category,
            amount: Number(data.amount),
            currency: data.currency,
            description: data.description || "",
            receiptUrl: data.receiptUrl || "",
            status: data.status || "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            userID: auth.currentUser.uid
        });

        return true;
    } catch (e) {
        console.warn("offline save finance", e);
        return false;
    }
}


// =========================================
// VALIDATION VENTE
// =========================================

function validateVente(data) {
    if (!data.productName) return "Le produit est obligatoire";
    if (!data.productCategory) return "La catégorie est obligatoire";
    if (!data.productPrice || data.productPrice <= 0) return "Prix invalide";
    if (!data.quantity || data.quantity <= 0) return "Quantité invalide";

    return null;
}


// =========================================
// SAVE VENTE
// =========================================

async function saveVente(data) {
    if (!auth.currentUser) {
        showMessage("Connectez-vous", "error");
        return false;
    }

    try {
        await addDoc(collection(db, "ventes"), {
            productName: data.productName,
            productCategory: data.productCategory,
            productPrice: Number(data.productPrice),
            quantity: Number(data.quantity),
            totalPrice: Number(data.productPrice) * Number(data.quantity),
            currency: data.currency,
            buyerName: data.buyerName || "",
            buyerPhone: data.buyerPhone || "",
            paymentMethod: data.paymentMethod || "cash",
            status: data.status || "pending",
            notes: data.notes || "",
            soldAt: serverTimestamp(),
            soldBy: auth.currentUser.uid,
            userID: auth.currentUser.uid
        });

        return true;
    } catch (e) {
        console.warn("offline save vente", e);
        return false;
    }
}


// =========================================
// FORM FINANCE
// =========================================

document.getElementById("finance-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
        title: document.getElementById("title").value.trim(),
        type: document.getElementById("type").value,
        category: document.getElementById("category").value.trim(),
        amount: document.getElementById("amount").value,
        currency: document.getElementById("currency").value,
        description: document.getElementById("description").value.trim(),
        receiptUrl: document.getElementById("receiptUrl").value.trim(),
        status: document.getElementById("status").value
    };

    const error = validateFinance(data);
    if (error) return showMessage(error, "error");

    const ok = await saveFinance(data);

    if (ok) {
        showMessage("Finance enregistrée");
        e.target.reset();
    } else {
        showMessage("Erreur de sauvegarde (offline possible)", "error");
    }
});


// =========================================
// FORM VENTE
// =========================================

document.getElementById("vente-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
        productName: document.getElementById("productName").value.trim(),
        productCategory: document.getElementById("productCategory").value.trim(),
        productPrice: document.getElementById("productPrice").value,
        quantity: document.getElementById("quantity").value,
        currency: document.getElementById("v_currency").value,
        buyerName: document.getElementById("buyerName").value.trim(),
        buyerPhone: document.getElementById("buyerPhone").value.trim(),
        paymentMethod: document.getElementById("paymentMethod").value,
        status: document.getElementById("v_status").value,
        notes: document.getElementById("notes").value.trim()
    };

    const error = validateVente(data);
    if (error) return showMessage(error, "error");

    const ok = await saveVente(data);

    if (ok) {
        showMessage("Vente enregistrée");
        e.target.reset();
    } else {
        showMessage("Erreur de sauvegarde (offline possible)", "error");
    }
});