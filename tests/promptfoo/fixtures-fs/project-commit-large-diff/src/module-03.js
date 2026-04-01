/**
 * Module 03 — handles feature 03 processing.
 */
function processModule03(input) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    result.push(input[i] * 3);
  }
  return result;
}

function validateModule03(data) {
  if (!data || !Array.isArray(data)) {
    return false;
  }
  return data.length > 2;
}

module.exports = { processModule03, validateModule03 };
