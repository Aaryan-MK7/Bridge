function safeEmployeeDto(employee) {
  if (!employee) return null;
  const source = typeof employee.toObject === 'function'
    ? employee.toObject({ virtuals: false, getters: false, transform: false })
    : employee;
  const id = source._id ? String(source._id) : undefined;

  return compact({
    _id: id,
    id,
    employeeId: source.employeeId,
    name: source.name,
    startDate: source.startDate,
    title: source.title || '',
    address: source.address || '',
    email: source.email || '',
    role: source.role || 'user',
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  });
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

module.exports = { safeEmployeeDto };
