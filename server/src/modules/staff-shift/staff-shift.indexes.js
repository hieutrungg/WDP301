// Single source for the UC38 indexes, shared by the Mongoose model and the migration so the two
// cannot drift. Every index comes from a query the module runs.
export const STAFF_SHIFT_INDEXES = Object.freeze({
  staff_shifts: Object.freeze([
    // Shifts of one branch by start time (list, dashboard).
    { fields: { branchId: 1, startTime: -1 }, options: { name: "idx_staff_shift_branch_start" } },
    // Overlap check when a shift is assigned to an employee.
    { fields: { employeeAccountId: 1, startTime: 1 }, options: { name: "idx_staff_shift_employee_start" } },
  ]),
});

export const applyIndexes = (schema, collectionName) => {
  for (const { fields, options } of STAFF_SHIFT_INDEXES[collectionName]) {
    schema.index(fields, options);
  }
};
