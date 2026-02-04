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
export declare function truncateArray<T>(array: T[], limit: number, fromEnd?: boolean): {
    items: T[];
    meta: TruncationMeta;
};
/**
 * Truncate a string to a maximum length
 */
export declare function truncateString(text: string, maxLength: number): {
    text: string;
    meta: TruncationMeta;
};
export interface SnapshotNode {
    role?: string;
    name?: string;
    children?: SnapshotNode[];
    [key: string]: any;
}
export interface SnapshotTruncationResult {
    tree: SnapshotNode | null;
    meta: TruncationMeta & {
        maxDepthReached: boolean;
    };
}
/**
 * Truncate an accessibility snapshot tree to a maximum number of elements and depth
 */
export declare function truncateSnapshot(snapshot: SnapshotNode, maxElements: number, maxDepth: number): SnapshotTruncationResult;
/**
 * Count all nodes in a snapshot tree
 */
export declare function countNodes(node: SnapshotNode): number;
/**
 * Parse YAML-like snapshot text and count elements
 */
export declare function countSnapshotElements(snapshotText: string): number;
/**
 * Truncate YAML-like snapshot text to a maximum number of elements
 */
export declare function truncateSnapshotText(snapshotText: string, maxElements: number): {
    text: string;
    meta: TruncationMeta;
};
//# sourceMappingURL=truncate.d.ts.map