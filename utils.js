// utils.js
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');  // Escape special characters for regex
}

module.exports = { escapeRegExp };

