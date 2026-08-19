/**
 * Type declarations for the official Qubic vault library.
 * The library ships only JS (no .d.ts), so we describe the surface
 * we use here. Anything not covered by this shim is `any`.
 */

declare module "@qubic-lib/qubic-ts-vault-library" {
  export interface QubicAsset {
    publicId: string;
    contractIndex: number;
    assetName: string;
    contractName: string;
    ownedAmount: number;
    possessedAmount: number;
    tick: number;
    reportingNodes: string[];
    issuerIdentity: string;
  }

  export interface ISeed {
    alias: string;
    publicId: string;
    encryptedSeed: string;
    balance: number;
    balanceTick: number;
    lastUpdate?: Date;
    assets?: QubicAsset[];
    isExported?: boolean;
    isOnlyWatch?: boolean;
  }

  export class QubicVault {
    constructor();
    runningConfiguration: {
      seeds: ISeed[];
      publicKey: JsonWebKey | undefined;
    };
    privateKey: CryptoKey | null;
    publicKey: CryptoKey | null;
    isWalletReady: boolean;

    importAndUnlock(
      selectedFileIsVaultFile: boolean,
      password: string,
      selectedConfigFile: File | null,
      file: File | null,
      unlock?: boolean,
    ): Promise<boolean>;

    getSeeds(): ISeed[];
    getSeed(publicId: string): ISeed | undefined;
    revealSeed(publicId: string): Promise<string>;
  }
}
