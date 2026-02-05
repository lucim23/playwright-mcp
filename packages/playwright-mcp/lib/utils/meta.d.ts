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
import type { TruncationMeta } from './truncate';
export interface ResponseMeta {
    truncated?: boolean;
    returnedCount?: number;
    totalCount?: number;
    limit?: number;
    snapshotDisabled?: boolean;
    disabledReason?: string;
    hint?: string;
    quality?: string;
    dimensions?: string;
    sizeBytes?: number;
    maxDepthReached?: boolean;
    format?: string;
    filtered?: boolean;
    filteredOut?: number;
    filterType?: string;
    filterRoles?: string[];
}
/**
 * Build a response meta object for including in tool responses
 */
export declare function buildResponseMeta(options: {
    truncation?: TruncationMeta;
    snapshotDisabled?: boolean;
    disabledReason?: string;
    hint?: string;
    quality?: string;
    dimensions?: string;
    sizeBytes?: number;
    format?: string;
    filtered?: boolean;
    filteredOut?: number;
    filterType?: string;
    filterRoles?: string[];
}): ResponseMeta;
/**
 * Format meta information as a markdown section
 */
export declare function formatMetaAsMarkdown(meta: ResponseMeta): string;
/**
 * Add meta section to response text
 */
export declare function appendMetaToResponse(responseText: string, meta: ResponseMeta): string;
//# sourceMappingURL=meta.d.ts.map