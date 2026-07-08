const num = 35204;
const d1 = new Date(Date.UTC(1899, 11, 30 + num));
console.log("d1:", d1.toISOString().split("T")[0]);

const excelEpoch = new Date(1899, 11, 30);
const d2 = new Date(excelEpoch.getTime() + num * 86400000);
console.log("d2:", d2.toISOString().split("T")[0]);

const d3 = new Date((num - 25569) * 86400000);
console.log("d3:", d3.toISOString().split("T")[0]);

// Let's test the correction:
// In Excel, 35204 is 1996-05-20.
// Let's check:
const dCorrect = new Date(Date.UTC(1899, 11, 30 + num - (num > 60 ? 1 : 0)));
console.log("dCorrect:", dCorrect.toISOString().split("T")[0]);

// Wait! If dCorrect is 1996-05-19, what if we use:
const dCorrect2 = new Date(Date.UTC(1899, 11, 30 + num + (num < 60 ? 0 : 0))); // Wait, let's see what works
