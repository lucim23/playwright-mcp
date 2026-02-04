/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface TruncationMeta {
  truncated: boolean;
  returnedCount: number;
  totalCount: number;
  limit?: number;
}

/**
 * Truncate an array to a maximum number of elements
 */
export function truncateArray<T>(
  array: T[],
  limit: number,
  fromEnd: boolean = true
): { items: T[]; meta: TruncationMeta } {
  const total = array.length;
  const truncated = total > limit;
  const items = fromEnd ? array.slice(-limit) : array.slice(0, limit);

  return {
    items,
    meta: {
      truncated,
      returnedCount: items.length,
      totalCount: total,
      limit
    }
  };
}

/**
 * Truncate a string to a maximum length
 */
export function truncateString(
  text: string,
  maxLength: number
): { text: string; meta: TruncationMeta } {
  const total = text.length;
  const truncated = total > maxLength;
  const resultText = truncated ? text.slice(0, maxLength) + '...[truncated]' : text;

  return {
    text: resultText,
    meta: {
      truncated,
      returnedCount: Math.min(total, maxLength),
      totalCount: total,
      limit: maxLength
    }
  };
}

export interface SnapshotNode {
  role?: string;
  name?: string;
  children?: SnapshotNode[];
  [key: string]: any;
}

export interface SnapshotTruncationResult {
  tree: SnapshotNode | null;
  meta: TruncationMeta & { maxDepthReached: boolean };
}

/**
 * Truncate an accessibility snapshot tree to a maximum number of elements and depth
 */
export function truncateSnapshot(
  snapshot: SnapshotNode,
  maxElements: number,
  maxDepth: number
): SnapshotTruncationResult {
  let count = 0;
  const total = countNodes(snapshot);
  let maxDepthReached = false;

  function traverse(node: SnapshotNode, depth: number): SnapshotNode | null {
    if (count >= maxElements) return null;
    if (depth > maxDepth) {
      maxDepthReached = true;
      return null;
    }

    count++;

    const result: SnapshotNode = { ...node };

    if (node.children && node.children.length > 0) {
      result.children = node.children
        .map(child => traverse(child, depth + 1))
        .filter((child): child is SnapshotNode => child !== null);
    }

    return result;
  }

  const tree = traverse(snapshot, 0);

  return {
    tree,
    meta: {
      truncated: count >= maxElements || maxDepthReached,
      returnedCount: count,
      totalCount: total,
      limit: maxElements,
      maxDepthReached
    }
  };
}

/**
 * Count all nodes in a snapshot tree
 */
export function countNodes(node: SnapshotNode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

/**
 * Parse YAML-like snapshot text and count elements
 */
export function countSnapshotElements(snapshotText: string): number {
  // Count lines that start with '- ' which indicate elements in YAML aria snapshot
  const lines = snapshotText.split('\n');
  let count = 0;
  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      count++;
    }
  }
  return count;
}

/**
 * Truncate YAML-like snapshot text to a maximum number of elements
 */
export function truncateSnapshotText(
  snapshotText: string,
  maxElements: number
): { text: string; meta: TruncationMeta } {
  const lines = snapshotText.split('\n');
  const resultLines: string[] = [];
  let elementCount = 0;
  let totalElements = 0;

  // First pass: count total elements
  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      totalElements++;
    }
  }

  // Second pass: truncate
  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      if (elementCount >= maxElements) {
        break;
      }
      elementCount++;
    }
    resultLines.push(line);
  }

  const truncated = totalElements > maxElements;
  if (truncated) {
    resultLines.push(`# ... truncated (${totalElements - elementCount} more elements)`);
  }

  return {
    text: resultLines.join('\n'),
    meta: {
      truncated,
      returnedCount: elementCount,
      totalCount: totalElements,
      limit: maxElements
    }
  };
}
