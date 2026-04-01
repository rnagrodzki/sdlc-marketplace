/**
 * Module 07 — handles feature 07 processing.
 */
function processModule07(input) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    result.push(input[i] * 7);
  }
  return result;
}

function validateModule07(data) {
  if (!data || !Array.isArray(data)) {
    return false;
  }
  return data.length > 6;
}

module.exports = { processModule07, validateModule07 };
