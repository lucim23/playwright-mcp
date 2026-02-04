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
/**
 * This file defines extended schemas for Playwright MCP tools
 * that add parameters for controlling snapshot behavior and output size.
 */
import { z } from 'zod';
export declare const returnSnapshotParam: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
export declare const elementSchema: z.ZodObject<{
    element: z.ZodOptional<z.ZodString>;
    ref: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ref: string;
    element?: string | undefined;
}, {
    ref: string;
    element?: string | undefined;
}>;
export declare const enhancedClickSchema: z.ZodObject<{
    element: z.ZodOptional<z.ZodString>;
    ref: z.ZodString;
} & {
    doubleClick: z.ZodOptional<z.ZodBoolean>;
    button: z.ZodOptional<z.ZodEnum<["left", "right", "middle"]>>;
    modifiers: z.ZodOptional<z.ZodArray<z.ZodEnum<["Alt", "Control", "ControlOrMeta", "Meta", "Shift"]>, "many">>;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
    ref: string;
    button?: "left" | "right" | "middle" | undefined;
    element?: string | undefined;
    doubleClick?: boolean | undefined;
    modifiers?: ("Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift")[] | undefined;
}, {
    ref: string;
    button?: "left" | "right" | "middle" | undefined;
    returnSnapshot?: boolean | undefined;
    element?: string | undefined;
    doubleClick?: boolean | undefined;
    modifiers?: ("Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift")[] | undefined;
}>;
export declare const enhancedTypeSchema: z.ZodObject<{
    element: z.ZodOptional<z.ZodString>;
    ref: z.ZodString;
} & {
    text: z.ZodString;
    submit: z.ZodOptional<z.ZodBoolean>;
    slowly: z.ZodOptional<z.ZodBoolean>;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    text: string;
    returnSnapshot: boolean;
    ref: string;
    element?: string | undefined;
    submit?: boolean | undefined;
    slowly?: boolean | undefined;
}, {
    text: string;
    ref: string;
    returnSnapshot?: boolean | undefined;
    element?: string | undefined;
    submit?: boolean | undefined;
    slowly?: boolean | undefined;
}>;
export declare const enhancedHoverSchema: z.ZodObject<{
    element: z.ZodOptional<z.ZodString>;
    ref: z.ZodString;
} & {
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
    ref: string;
    element?: string | undefined;
}, {
    ref: string;
    returnSnapshot?: boolean | undefined;
    element?: string | undefined;
}>;
export declare const enhancedDragSchema: z.ZodObject<{
    startElement: z.ZodString;
    startRef: z.ZodString;
    endElement: z.ZodString;
    endRef: z.ZodString;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
    startElement: string;
    startRef: string;
    endElement: string;
    endRef: string;
}, {
    startElement: string;
    startRef: string;
    endElement: string;
    endRef: string;
    returnSnapshot?: boolean | undefined;
}>;
export declare const enhancedSelectOptionSchema: z.ZodObject<{
    element: z.ZodOptional<z.ZodString>;
    ref: z.ZodString;
} & {
    values: z.ZodArray<z.ZodString, "many">;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
    ref: string;
    values: string[];
    element?: string | undefined;
}, {
    ref: string;
    values: string[];
    returnSnapshot?: boolean | undefined;
    element?: string | undefined;
}>;
export declare const enhancedPressKeySchema: z.ZodObject<{
    key: z.ZodString;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
    key: string;
}, {
    key: string;
    returnSnapshot?: boolean | undefined;
}>;
export declare const enhancedFillFormSchema: z.ZodObject<{
    fields: z.ZodRecord<z.ZodString, z.ZodString>;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
    fields: Record<string, string>;
}, {
    fields: Record<string, string>;
    returnSnapshot?: boolean | undefined;
}>;
export declare const enhancedNavigateSchema: z.ZodObject<{
    url: z.ZodString;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    url: string;
    returnSnapshot: boolean;
}, {
    url: string;
    returnSnapshot?: boolean | undefined;
}>;
export declare const enhancedNavigateBackSchema: z.ZodObject<{
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
}, {
    returnSnapshot?: boolean | undefined;
}>;
export declare const enhancedWaitSchema: z.ZodObject<{
    time: z.ZodOptional<z.ZodNumber>;
    text: z.ZodOptional<z.ZodString>;
    textGone: z.ZodOptional<z.ZodString>;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
    time?: number | undefined;
    text?: string | undefined;
    textGone?: string | undefined;
}, {
    time?: number | undefined;
    text?: string | undefined;
    textGone?: string | undefined;
    returnSnapshot?: boolean | undefined;
}>;
export declare const enhancedResizeSchema: z.ZodObject<{
    width: z.ZodNumber;
    height: z.ZodNumber;
    returnSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    returnSnapshot: boolean;
    width: number;
    height: number;
}, {
    width: number;
    height: number;
    returnSnapshot?: boolean | undefined;
}>;
export declare const enhancedSnapshotSchema: z.ZodObject<{
    filename: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<["full", "summary"]>>>;
    selector: z.ZodOptional<z.ZodString>;
    maxElements: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxDepth: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    maxElements: number;
    format: "full" | "summary";
    maxDepth: number;
    filename?: string | undefined;
    selector?: string | undefined;
}, {
    maxElements?: number | undefined;
    format?: "full" | "summary" | undefined;
    filename?: string | undefined;
    selector?: string | undefined;
    maxDepth?: number | undefined;
}>;
export declare const enhancedConsoleMessagesSchema: z.ZodObject<{
    level: z.ZodDefault<z.ZodEnum<["error", "warning", "info", "debug"]>>;
    filename: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    countOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    since: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    countOnly: boolean;
    level: "error" | "warning" | "info" | "debug";
    filename?: string | undefined;
    since?: string | undefined;
}, {
    limit?: number | undefined;
    countOnly?: boolean | undefined;
    filename?: string | undefined;
    level?: "error" | "warning" | "info" | "debug" | undefined;
    since?: string | undefined;
}>;
export declare const enhancedNetworkRequestsSchema: z.ZodObject<{
    includeStatic: z.ZodDefault<z.ZodBoolean>;
    filename: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    countOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    format: z.ZodDefault<z.ZodOptional<z.ZodEnum<["full", "compact"]>>>;
}, "strip", z.ZodTypeAny, {
    format: "full" | "compact";
    limit: number;
    countOnly: boolean;
    includeStatic: boolean;
    filename?: string | undefined;
}, {
    format?: "full" | "compact" | undefined;
    limit?: number | undefined;
    countOnly?: boolean | undefined;
    filename?: string | undefined;
    includeStatic?: boolean | undefined;
}>;
export declare const enhancedScreenshotSchema: z.ZodObject<{
    type: z.ZodDefault<z.ZodEnum<["png", "jpeg"]>>;
    filename: z.ZodOptional<z.ZodString>;
    element: z.ZodOptional<z.ZodString>;
    ref: z.ZodOptional<z.ZodString>;
    fullPage: z.ZodOptional<z.ZodBoolean>;
    quality: z.ZodDefault<z.ZodOptional<z.ZodEnum<["thumbnail", "medium", "full"]>>>;
    jpegQuality: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    type: "png" | "jpeg";
    quality: "full" | "thumbnail" | "medium";
    jpegQuality: number;
    element?: string | undefined;
    ref?: string | undefined;
    filename?: string | undefined;
    fullPage?: boolean | undefined;
}, {
    element?: string | undefined;
    ref?: string | undefined;
    type?: "png" | "jpeg" | undefined;
    filename?: string | undefined;
    fullPage?: boolean | undefined;
    quality?: "full" | "thumbnail" | "medium" | undefined;
    jpegQuality?: number | undefined;
}>;
export declare const enhancedEvaluateSchema: z.ZodObject<{
    function: z.ZodString;
    element: z.ZodOptional<z.ZodString>;
    ref: z.ZodOptional<z.ZodString>;
    maxOutputLength: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    function: string;
    maxOutputLength: number;
    element?: string | undefined;
    ref?: string | undefined;
}, {
    function: string;
    element?: string | undefined;
    ref?: string | undefined;
    maxOutputLength?: number | undefined;
}>;
export declare const enhancedRunCodeSchema: z.ZodObject<{
    code: z.ZodString;
    maxOutputLength: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    outputFile: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    maxOutputLength: number;
    code: string;
    outputFile?: string | undefined;
}, {
    code: string;
    maxOutputLength?: number | undefined;
    outputFile?: string | undefined;
}>;
export type EnhancedClickParams = z.infer<typeof enhancedClickSchema>;
export type EnhancedTypeParams = z.infer<typeof enhancedTypeSchema>;
export type EnhancedHoverParams = z.infer<typeof enhancedHoverSchema>;
export type EnhancedDragParams = z.infer<typeof enhancedDragSchema>;
export type EnhancedSelectOptionParams = z.infer<typeof enhancedSelectOptionSchema>;
export type EnhancedPressKeyParams = z.infer<typeof enhancedPressKeySchema>;
export type EnhancedFillFormParams = z.infer<typeof enhancedFillFormSchema>;
export type EnhancedNavigateParams = z.infer<typeof enhancedNavigateSchema>;
export type EnhancedNavigateBackParams = z.infer<typeof enhancedNavigateBackSchema>;
export type EnhancedWaitParams = z.infer<typeof enhancedWaitSchema>;
export type EnhancedResizeParams = z.infer<typeof enhancedResizeSchema>;
export type EnhancedSnapshotParams = z.infer<typeof enhancedSnapshotSchema>;
export type EnhancedConsoleMessagesParams = z.infer<typeof enhancedConsoleMessagesSchema>;
export type EnhancedNetworkRequestsParams = z.infer<typeof enhancedNetworkRequestsSchema>;
export type EnhancedScreenshotParams = z.infer<typeof enhancedScreenshotSchema>;
export type EnhancedEvaluateParams = z.infer<typeof enhancedEvaluateSchema>;
export type EnhancedRunCodeParams = z.infer<typeof enhancedRunCodeSchema>;
//# sourceMappingURL=schemas.d.ts.map