export const readReviewRating = (value) => {
  const fail = () => { throw new Error("Movie review data requires owner review; no records were changed"); };
  const numeric = typeof value === "number" ? value
    : ["Decimal128", "Long", "Int32", "Double"].includes(value?._bsontype) ? Number(value.toString()) : NaN;
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) fail();
  if (value?._bsontype === "Decimal128") {
    // Reject a Decimal128 fraction even if conversion would round it to an integer.
    const match = /^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(value.toString());
    if (!match) fail();
    const coefficient = `${match[1]}${match[2] ?? ""}`.replace(/^0+/, "");
    const trailingZeros = coefficient.match(/0*$/)[0].length;
    const digits = coefficient.slice(0, coefficient.length - trailingZeros);
    const scale = Number(match[3] ?? 0) - (match[2]?.length ?? 0) + trailingZeros;
    if (digits !== String(numeric) || scale !== 0) fail();
  }
  return numeric;
};
