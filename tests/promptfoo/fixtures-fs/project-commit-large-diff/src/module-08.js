/**
 * Module 08 — handles feature 08 processing.
 */
function processModule08(input) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    result.push(input[i] * 8);
  }
  return result;
}

function validateModule08(data) {
  if (!data || !Array.isArray(data)) {
    return false;
  }
  return data.length > 7;
}

module.exports = { processModule08, validateModule08 };
