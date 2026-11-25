const { test } = require("node:test");
const assert = require("node:assert/strict");
const N = require("../src/network");

const first = {
  id: 100,
  owner: "a",
  recipient: "one",
  time: 2,
  flagged: true,
  customerName: "А",
  recipientName: "Один",
};
const second = { ...first, id: 101, time: 5 };
const elsewhere = {
  ...first,
  id: 102,
  recipient: "two",
  time: 10,
  recipientName: "Два",
};

test("shared recipients and shared customers are explicit relationships among flagged records", () => {
  const fourth = { ...first, id: 103, owner: "b" };
  const unrelated = { ...fourth, id: 104, recipient: "other" };
  const regular = { ...first, id: 105, flagged: false };
  assert.deepEqual(
    N.related(
      first,
      [regular, elsewhere, second, unrelated, fourth, first],
      (row) => row.owner,
    ),
    {
      same: [second, fourth],
      viaCustomer: [elsewhere],
    },
  );
});

test("3D layout uses one node per participant and separates repeated links by order", () => {
  const graph = N.layout([second, elsewhere, first]);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 3);
  assert.deepEqual(
    graph.edges.map((edge) => edge.id),
    [100, 101, 102],
  );
  assert.equal(graph.edges[0].to, graph.edges[1].to);
  assert.ok(graph.edges[0].bend[2] < graph.edges[1].bend[2]);
  assert.deepEqual(N.layout([]), { nodes: [], edges: [] });
});

test("time cutoff uses the transfer or report creation timestamp and includes the boundary", () => {
  const now = 7 * 86400000;
  assert.equal(N.fitsTime({ time: 0 }, "7", now), true);
  assert.equal(N.fitsTime({ time: -1 }, "7", now), false);
  assert.equal(N.fitsTime({ time: -1 }, "", now), true);
});

test("case timeline preserves order, actor lanes, and investigation phase", () => {
  const graph = N.timeline([
    { role: "customer", phase: 0 },
    { role: "analyst", phase: 1 },
    { role: "analyst", phase: 2 },
  ]);
  assert.deepEqual(
    graph.nodes.map((n) => n.label),
    ["1", "2", "3"],
  );
  assert.ok(graph.nodes[0].point[0] < graph.nodes[2].point[0]);
  assert.notEqual(graph.nodes[0].point[1], graph.nodes[1].point[1]);
  assert.ok(graph.nodes[1].point[2] < graph.nodes[2].point[2]);
});
