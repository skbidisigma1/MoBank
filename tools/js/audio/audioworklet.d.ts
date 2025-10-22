// Type definitions for AudioWorklet API
// These are needed for pitch-worklet.ts to compile

declare const sampleRate: number;

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: any) => AudioWorkletProcessor
): void;

interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare var AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (options?: any): AudioWorkletProcessor;
  parameterDescriptors?: any[];
};
