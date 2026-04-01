/**
 * Module 02 — handles feature 02 processing.
 */
function processModule02(input) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    result.push(input[i] * 2);
  }
  return result;
}

function validateModule02(data) {
  if (!data || !Array.isArray(data)) {
    return false;
  }
  return data.length > 1;
}

module.exports = { processModule02, validateModule02 };
