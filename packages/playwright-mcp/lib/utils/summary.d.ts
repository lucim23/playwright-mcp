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
export interface SnapshotSummary {
    pageTitle?: string;
    pageUrl?: string;
    landmarks: string[];
    interactive: {
        buttons: number;
        links: number;
        inputs: number;
        selects: number;
        checkboxes: number;
        radios: number;
        textareas: number;
        total: number;
    };
    content: {
        headings: string[];
        keyText: string[];
        images: number;
        tables: number;
        lists: number;
    };
    totalElements: number;
}
/**
 * Parse YAML-like snapshot text to extract element counts
 */
export declare function parseSnapshotElements(snapshotText: string): Map<string, number>;
/**
 * Extract landmarks from snapshot text
 */
export declare function extractLandmarks(snapshotText: string): string[];
/**
 * Extract headings from snapshot text
 */
export declare function extractHeadings(snapshotText: string): string[];
/**
 * Extract key text content from snapshot
 */
export declare function extractKeyText(snapshotText: string): string[];
/**
 * Generate a summary of a snapshot for quick overview
 */
export declare function summarizeSnapshot(snapshotText: string, options?: {
    pageTitle?: string;
    pageUrl?: string;
}): SnapshotSummary;
/**
 * Format a snapshot summary as a compact text representation
 */
export declare function formatSnapshotSummary(summary: SnapshotSummary): string;
//# sourceMappingURL=summary.d.ts.map