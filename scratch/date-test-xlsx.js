import XLSX from "xlsx";

const cell = { t: "n", v: 35204, z: "yyyy-mm-dd" };
XLSX.utils.format_cell(cell);
console.log("Formatted cell:", cell.w);

const cell2 = { t: "n", v: 41062, z: "yyyy-mm-dd" };
XLSX.utils.format_cell(cell2);
console.log("Formatted cell 2:", cell2.w);
