import test from "node:test";
import assert from "node:assert/strict";
import { parseRewardReservations, reservedAssetForIdentity } from "./reward-reservations.mjs";

const rabbitId = "a".repeat(64);
const starId = "b".repeat(64);
const catalog = {
  files: ["Munch on this RABBIT.gif", "star.png"],
  assets: {
    "Munch on this RABBIT.gif": { assetId: rabbitId },
    "star.png": { assetId: starId }
  },
  assetsById: {
    [rabbitId]: { filename: "Munch on this RABBIT.gif" },
    [starId]: { filename: "star.png" }
  },
  filenameHistory: {
    "Munch on this RABBIT.gif": rabbitId,
    "star.png": starId,
    "old rabbit name.gif": rabbitId
  }
};

test("aliases are case-insensitive, @-neutralized, and resolve Windows paths to GIF content", () => {
  const reservations = parseRewardReservations(
    '@Transrantula, transrantula-0000 => "E:\\sites\\kazvt.com-1\\zzz_assets\\rewards\\Munch on this RABBIT.gif"',
    catalog
  );
  assert.deepEqual([...reservations.assetIds], [rabbitId]);
  assert.equal(reservedAssetForIdentity(reservations, "@TRANSRANTULA"), rabbitId);
  assert.equal(reservedAssetForIdentity(reservations, "DifferentName", "transrantula-0000"), rabbitId);
  assert.equal(reservedAssetForIdentity(reservations, "unrelated"), "");
});

test("filename-only, historical filename, and forgiving separators are accepted", () => {
  for (const separator of ["->", "=>", "=", ":", "→"]) {
    const reservations = parseRewardReservations(`viewer-${separator} Munch on this RABBIT.gif`, catalog);
    assert.equal(reservedAssetForIdentity(reservations, "VIEWER"), rabbitId);
  }
  const renamed = parseRewardReservations(
    'viewer; viewer-0000 = "E:\\old\\old rabbit name.gif"', catalog
  );
  assert.equal(reservedAssetForIdentity(renamed, "viewer-0000"), rabbitId);
});

test("malformed, unknown, or conflicting reservation rules fail closed", () => {
  assert.throws(() => parseRewardReservations("missing separator", catalog), /separator/);
  assert.throws(() => parseRewardReservations("viewer -> absent.gif", catalog), /not found/);
  assert.throws(() => parseRewardReservations("viewer -> star.png\nVIEWER => Munch on this RABBIT.gif", catalog), /more than one/);
});
