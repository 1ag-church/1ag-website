import assert from 'node:assert/strict';
import test from 'node:test';
import {moveBlockToGap} from './email-block-order.ts';

const blocks = ['heading', 'text', 'images', 'button'].map(id => ({id, text: `Content for ${id}`}));
const order = (id: string, gap: number) => moveBlockToGap(blocks, id, gap).map(block => block.id);

test('downward drops land at the indicated gap without skipping a block', () => {
  assert.deepEqual(order('heading', 2), ['text', 'heading', 'images', 'button']);
  assert.deepEqual(order('heading', 3), ['text', 'images', 'heading', 'button']);
  assert.deepEqual(order('text', 4), ['heading', 'images', 'button', 'text']);
});

test('upward drops support the first and intermediate positions', () => {
  assert.deepEqual(order('button', 0), ['button', 'heading', 'text', 'images']);
  assert.deepEqual(order('button', 1), ['heading', 'button', 'text', 'images']);
});

test('dropping on either edge of the source leaves order intact', () => {
  assert.equal(moveBlockToGap(blocks, 'text', 1), blocks);
  assert.equal(moveBlockToGap(blocks, 'text', 2), blocks);
  assert.equal(moveBlockToGap(blocks, 'removed', 0), blocks);
  assert.deepEqual(moveBlockToGap([], 'removed', 0), []);
});

test('moving preserves every block and its content without mutating the original', () => {
  const moved = moveBlockToGap(blocks, 'images', 0);
  assert.equal(moved[0], blocks[2]);
  assert.equal(new Set(moved).size, blocks.length);
  assert.deepEqual(blocks.map(block => block.id), ['heading', 'text', 'images', 'button']);
  assert.deepEqual(moved.map(block => block.text), ['Content for images', 'Content for heading', 'Content for text', 'Content for button']);
});
