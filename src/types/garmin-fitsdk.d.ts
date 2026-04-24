declare module "@garmin/fitsdk" {
  export const CrcCalculator: {
    calculateCRC(buf: Uint8Array, start: number, end: number): number;
  };
}
