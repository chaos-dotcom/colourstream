// Add declaration for aws-s3-multipart module
declare module '@uppy/aws-s3-multipart' {
  import Uppy from '@uppy/core';
  import { PluginOptions, BasePlugin, PluginTarget, UppyFile } from '@uppy/core';
  
  interface AwsS3MultipartOptions extends PluginOptions {
    companionUrl: string;
    companionHeaders?: Record<string, string>;
    limit?: number;
    retryDelays?: number[];
    chunkSize?: number;
    getChunkSize?: (file: any) => number;
    [key: string]: any;
  }
  
  class AwsS3Multipart<TMeta = Record<string, unknown>, TBody = Record<string, unknown>> extends BasePlugin<AwsS3MultipartOptions> {
    constructor(uppy: Uppy<TMeta, TBody>, opts?: AwsS3MultipartOptions);
  }
  
  export default AwsS3Multipart;
} 