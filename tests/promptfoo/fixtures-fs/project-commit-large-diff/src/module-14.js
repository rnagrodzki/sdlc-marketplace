/**
 * Module 14 — handles feature 14 processing.
 */
function processModule14(input) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    result.push(input[i] * 14);
  }
  return result;
}

function validateModule14(data) {
  if (!data || !Array.isArray(data)) {
    return false;
  }
  return data.length > 13;
}

module.exports = { processModule14, validateModule14 };
