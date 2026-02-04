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
export interface ToolResponse {
    content: Array<{
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}
export interface EnhancementContext {
    toolName: string;
    params: Record<string, any>;
    config: {
        snapshotMode?: 'incremental' | 'full' | 'none';
        imageResponses?: 'allow' | 'omit';
    };
}
/**
 * Apply enhancements to a tool response based on the tool name and parameters
 */
export declare function enhanceToolResponse(response: ToolResponse, context: EnhancementContext): ToolResponse;
//# sourceMappingURL=enhancer.d.ts.map