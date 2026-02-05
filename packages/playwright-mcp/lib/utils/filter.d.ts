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
export interface FilterOptions {
    includeRoles?: string[];
    excludeRoles?: string[];
}
export interface FilterMeta {
    filtered: boolean;
    totalElements: number;
    returnedCount: number;
    filteredOut: number;
    filterType: 'include' | 'exclude';
    roles: string[];
}
/**
 * Filter a YAML-like snapshot text by element roles.
 *
 * - `includeRoles`: Only keep elements matching these roles (ancestors preserved for context).
 * - `excludeRoles`: Remove elements matching these roles (children promoted to parent level).
 *
 * If both are provided, `includeRoles` takes priority.
 * Empty arrays are treated as not provided.
 */
export declare function filterSnapshotText(snapshotText: string, options: FilterOptions): {
    text: string;
    meta: FilterMeta;
};
//# sourceMappingURL=filter.d.ts.map