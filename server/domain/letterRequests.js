function safeLetterRequestDto(request) {
  if (!request) return null;
  const source = typeof request.toObject === 'function'
    ? request.toObject({ virtuals: false, getters: false, transform: false })
    : request;
  const {
    generatedLetterPath,
    docusignSigningUrl,
    ...safe
  } = source;
  return safe;
}

module.exports = { safeLetterRequestDto };
