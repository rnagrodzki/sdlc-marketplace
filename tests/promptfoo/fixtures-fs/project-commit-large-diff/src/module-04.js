/**
 * Module 04 — handles feature 04 processing.
 */
function processModule04(input) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    result.push(input[i] * 4);
  }
  return result;
}

function validateModule04(data) {
  if (!data || !Array.isArray(data)) {
    return false;
  }
  return data.length > 3;
}

module.exports = { processModule04, validateModule04 };
