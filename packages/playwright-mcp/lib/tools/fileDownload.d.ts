/**
 * Custom tool: file_download
 * Downloads a file from a URL and saves it to a local path.
 */
export interface FileDownloadParams {
    url: string;
    path: string;
}
export declare const fileDownloadToolDefinition: {
    name: string;
    description: string;
    inputSchema: {
        $schema: string;
        type: "object";
        properties: {
            url: {
                type: string;
                description: string;
            };
            path: {
                type: string;
                description: string;
            };
        };
        required: readonly ["url", "path"];
        additionalProperties: boolean;
    };
    annotations: {
        title: string;
        readOnlyHint: boolean;
        destructiveHint: boolean;
        openWorldHint: boolean;
    };
};
export declare function handleFileDownload(params: FileDownloadParams): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}>;
//# sourceMappingURL=fileDownload.d.ts.map