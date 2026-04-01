/**
 * Module 05 — handles feature 05 processing.
 */
function processModule05(input) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    result.push(input[i] * 5);
  }
  return result;
}

function validateModule05(data) {
  if (!data || !Array.isArray(data)) {
    return false;
  }
  return data.length > 4;
}

module.exports = { processModule05, validateModule05 };
