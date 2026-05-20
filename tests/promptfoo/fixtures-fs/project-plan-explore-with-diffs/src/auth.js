// Auth module — used to simulate staged/unstaged changes in diff fixture
'use strict';

function validateToken(token) {
  return token && token.length > 0;
}

module.exports = { validateToken };
