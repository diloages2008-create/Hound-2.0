import test from "node:test";
import assert from "node:assert/strict";

function createModel(initialId) {
  return {
    timeline: [initialId],
    currentIndex: 0,
    recommendationCalls: 0,
    skipEvents: 0
  };
}

function previous(model) {
  if (model.currentIndex > 0) model.currentIndex -= 1;
}

function next(model, recommendNextId) {
  if (model.currentIndex < model.timeline.length - 1) {
    model.currentIndex += 1;
    return;
  }
  model.skipEvents += 1;
  model.recommendationCalls += 1;
  const nextId = recommendNextId();
  model.timeline = [...model.timeline, nextId];
  model.currentIndex = model.timeline.length - 1;
}

test("A -> Next -> B -> Previous -> A -> Next -> same B", () => {
  const model = createModel("A");
  next(model, () => "B");
  assert.deepEqual(model.timeline, ["A", "B"]);
  assert.equal(model.currentIndex, 1);
  assert.equal(model.recommendationCalls, 1);

  previous(model);
  assert.equal(model.currentIndex, 0);
  assert.deepEqual(model.timeline, ["A", "B"]);

  next(model, () => "C");
  assert.equal(model.currentIndex, 1);
  assert.equal(model.timeline[model.currentIndex], "B");
  assert.deepEqual(model.timeline, ["A", "B"]);
  assert.equal(model.recommendationCalls, 1);
  assert.equal(model.skipEvents, 1);
});

test("Previous never generates a track", () => {
  const model = createModel("A");
  previous(model);
  assert.equal(model.currentIndex, 0);
  assert.deepEqual(model.timeline, ["A"]);
  assert.equal(model.recommendationCalls, 0);
});

test("Next only recommends at timeline end", () => {
  const model = createModel("A");
  next(model, () => "B");
  previous(model); // back to A, forward history exists
  const beforeCalls = model.recommendationCalls;
  next(model, () => "C"); // should consume forward B, not recommend C
  assert.equal(model.timeline[model.currentIndex], "B");
  assert.equal(model.recommendationCalls, beforeCalls);

  // now at end, next should recommend
  next(model, () => "D");
  assert.equal(model.timeline[model.currentIndex], "D");
  assert.equal(model.recommendationCalls, beforeCalls + 1);
});

