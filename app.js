// app.js: the behaviour of the page.
// The data now lives on the SERVER (in the Excel file). The page asks the API with fetch.

// The address of the API. On your computer it is the Express server from Rung 6.
const API_URL = "http://localhost:3000";
const PRODUCTS_URL = API_URL + "/api/products";

const statusEl = document.getElementById("status");
const rowsEl = document.getElementById("rows");

// Show a message: type is "loading", "success" or "error" (colors come from the CSS)
function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = type || "";
}

// One safe fetch for the whole page: returns the data, or throws an Error with a clear message
async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 204) return null;                     // success with no body (DELETE)

  const data = await response.json().catch(() => null);         // null if the body is not JSON
  if (!response.ok) {
    throw new Error(data?.message || "Server responded with status " + response.status);
  }
  return data;
}

// Build the table. textContent (never innerHTML) because the data comes from outside.
function renderRows(products) {
  rowsEl.innerHTML = "";
  products.forEach((product) => {
    const tr = document.createElement("tr");
    [product.id, product.name, "$" + product.price, product.category, product.available ? "Yes" : "No"].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    });
    const actions = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.dataset.action = "edit";
    editButton.dataset.id = product.id;
    actions.append(editButton);
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.className = "danger";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = product.id;
    actions.append(" ", deleteButton);
    tr.append(actions);
    rowsEl.append(tr);
  });
}

let currentProducts = [];                                       // the last list received from the server

// Ask the API for the list, then draw it
async function loadProducts() {
  setStatus("Loading products...", "loading");
  try {
    const products = await api(PRODUCTS_URL);
    currentProducts = products;
    renderRows(products);
    setStatus(products.length + " products", "success");
  } catch (error) {
    setStatus("Could not load the products: " + error.message, "error");
  }
}

// ----- The form (add and edit) -----
const form = document.getElementById("form");
const nameInput = document.getElementById("name");
const priceInput = document.getElementById("price");
const categoryInput = document.getElementById("category");
const availableInput = document.getElementById("available");
const saveButton = document.getElementById("save");
const cancelButton = document.getElementById("cancel");

let editingId = null;                                           // null = the form adds; a number = the form edits

// Read the form into the object the API expects
function readForm() {
  return {
    name: nameInput.value.trim(),
    price: Number(priceInput.value),                            // inputs give text; the API wants a number
    category: categoryInput.value.trim() || "Other",
    available: availableInput.checked,
  };
}

// Back to "add" mode with an empty form
function resetForm() {
  editingId = null;
  form.reset();
  availableInput.checked = true;
  saveButton.textContent = "Add product";
  cancelButton.classList.add("hidden");
}

// Put a product into the form and switch to "edit" mode
function startEditing(product) {
  editingId = product.id;
  nameInput.value = product.name;
  priceInput.value = product.price;
  categoryInput.value = product.category;
  availableInput.checked = product.available;
  saveButton.textContent = "Save changes (#" + product.id + ")";
  cancelButton.classList.remove("hidden");
  nameInput.focus();
}

cancelButton.addEventListener("click", resetForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();                                       // do not reload the page

  const product = readForm();
  if (product.name === "" || priceInput.value === "") {
    setStatus("Please type a name and a price.", "error");
    return;
  }

  const isEditing = editingId !== null;
  saveButton.disabled = true;                                   // no double click while the request travels
  setStatus("Saving...", "loading");
  try {
    await api(isEditing ? PRODUCTS_URL + "/" + editingId : PRODUCTS_URL, {
      method: isEditing ? "PUT" : "POST",                       // PUT = replace an existing product
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    resetForm();
    await loadProducts();                                       // ask the server for the fresh list
    setStatus(isEditing ? "Product updated." : "Product added.", "success");
  } catch (error) {
    setStatus("Could not save the product: " + error.message, "error");
  } finally {
    saveButton.disabled = false;
  }
});

// ----- Buttons in the table: ONE listener for all of them (event delegation) -----
rowsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.id);                         // data-id is text; ids are numbers
  const product = currentProducts.find((p) => p.id === id);

  if (button.dataset.action === "delete") {
    if (!confirm('Delete "' + product.name + '"?')) return;

    button.disabled = true;
    setStatus("Deleting...", "loading");
    try {
      await api(PRODUCTS_URL + "/" + id, { method: "DELETE" });
      if (editingId === id) resetForm();                        // do not keep editing a deleted product
      await loadProducts();
      setStatus("Product deleted.", "success");
    } catch (error) {
      button.disabled = false;
      setStatus("Could not delete the product: " + error.message, "error");
    }
    return;
  }

  if (button.dataset.action === "edit") {
    startEditing(product);
  }
});

// ----- Download the Excel file kept by the server -----
document.getElementById("download").href = API_URL + "/api/export";

loadProducts();