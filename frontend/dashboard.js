function start() {
  const table = document.getElementById("entities");
  if (!(table instanceof HTMLTableElement))
    throw new ReferenceError("Unable to find our table");

  const sse = new EventSource("http://localhost:3000/entities");
  sse.onerror = console.error.bind(console);
  sse.onopen = (ev) => console.log(ev);
  sse.onmessage = (ev) => {
    console.log(ev);
    // Building initial table
    buildInitialTable(table, JSON.parse(ev.data));
  };
  sse.addEventListener("update", (ev) => {
    console.log("update", ev.data);
    updateParameters(table, JSON.parse(ev.data));
  });
  sse.addEventListener("insert", (ev) => {
    console.log("insert", ev.data);
    insertEntity(table, JSON.parse(ev.data));
  });
}

/**
 *
 * @param {HTMLTableElement} table
 */
function calcTotals(table) {
  const tboby = table.tBodies[0];
  const { tFoot } = table;
  // passing all cols calculating all 4 aggregated values
  for (let col = 1; col < tboby.rows[0].cells.length; col++) {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const row of tboby.rows) {
      const cell = parseFloat(row.cells[col].dataset.value);
      sum += cell;
      if (cell < min) min = cell;
      if (cell > max) max = cell;
    }
    // set values to select
    const select = tFoot.rows[0].cells[col].getElementsByTagName("select")[0];
    select.querySelector("[label=sum] option").textContent = sum.toFixed(4);
    select.querySelector("[label=min] option").textContent = min.toFixed(4);
    select.querySelector("[label=max] option").textContent = max.toFixed(4);
    select.querySelector("[label=avg] option").textContent = (
      sum / tboby.rows.length
    ).toFixed(4);
  }
}

/**
 * Updates cell information for paramter
 *
 * @param {HTMLTableDataCellElement} cell
 * @param {number} parameter
 */
function setCellData(cell, parameter) {
  cell.style.setProperty("--a", Math.abs(parameter).toFixed(3));
  cell.dataset.value = parameter.toFixed(4);
  cell.textContent = parameter.toFixed(4);
}

/**
 *
 * @param {HTMLTableSectionElement} tbody
 * @param {string} entity
 * @param {number[]} parameters
 */
function insertRow(tbody, entity, parameters) {
  const row = tbody.insertRow();
  // insert entity number
  const cell = row.insertCell();
  cell.id = entity;
  cell.textContent = entity;
  // insert parameters
  for (const parameter of parameters) {
    setCellData(row.insertCell(), parameter);
  }
}

/**
 * Creates (or recreates on reconnect) full table
 *
 * @param {HTMLTableElement} table
 * @param {[string, ...number[]][]} data
 */
function buildInitialTable(table, data) {
  const tbody = table.tBodies[0];
  tbody.innerHTML = "";
  for (const [entity, ...parameters] of data) {
    insertRow(tbody, entity, parameters);
  }
  calcTotals(table);
}

/**
 * Adds new entity to the table
 * @param {HTMLTableElement} table
 * @param {[string, ...number[]]} param0
 */
function insertEntity(table, [entity, ...parameters]) {
  const tbody = table.tBodies[0];
  insertRow(tbody, entity, parameters);
  calcTotals(table);
}

/**
 * Adds new entity to the table
 * @param {HTMLTableElement} table
 * @param {[string, ...number[]]} data
 */
function updateParameters(table, data) {
  const [entity] = data;
  const entityCell = table.querySelector(`#${entity}`);
  if (!(entityCell instanceof HTMLTableCellElement)) {
    console.error(
      "Received update for unknown entity %s, inserting",
      entity,
      entityCell
    );
    return insertEntity(table, data);
  }
  const row = /** @type {HTMLTableRowElement} */ (entityCell.parentElement);
  // updating cells
  for (let i = 1; i < entity.length; i++) {
    const cell = row.cells[i];
    setCellData(cell, data[i]);
  }
  calcTotals(table);
}

window.addEventListener("DOMContentLoaded", start);
