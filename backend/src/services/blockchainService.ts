import { ethers, Contract, Wallet } from 'ethers';
import { logger } from '../utils/logger';
import contractABI from '../../abi/CertificateRegistry.json';

class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: Wallet;
  private contract?: Contract;
  private contractAddress: string;

  constructor() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC || 'http://localhost:8545';
    const privateKey = process.env.PRIVATE_KEY;
    this.contractAddress = process.env.CONTRACT_ADDRESS || '';

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (privateKey) {
      this.wallet = new Wallet(privateKey, this.provider);
    } else {
      logger.warn('No private key configured, blockchain writes will fail');
      this.wallet = Wallet.createRandom().connect(this.provider) as unknown as Wallet;
    }

    if (this.contractAddress) {
      this.contract = new Contract(this.contractAddress, contractABI.abi, this.wallet);
    }
  }

  async issueCertificate(
    certHash: string,
    ipfsCid: string,
    expiryDate: number = 0
  ): Promise<string> {
    try {
      if (!this.contract) {
        throw new Error('Contract not configured');
      }

      const certHashBytes = ethers.id(certHash);
      const tx = await this.contract.issueCertificate(certHashBytes, ipfsCid, expiryDate);
      const receipt = await tx.wait();

      logger.info(`Certificate issued on blockchain: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error('Blockchain issue error:', error);
      throw new Error('Failed to issue certificate on blockchain');
    }
  }

  async revokeCertificate(certHash: string, reason: string): Promise<string> {
    try {
      if (!this.contract) {
        throw new Error('Contract not configured');
      }

      const certHashBytes = ethers.id(certHash);
      const tx = await this.contract.revokeCertificate(certHashBytes, reason);
      const receipt = await tx.wait();

      logger.info(`Certificate revoked on blockchain: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error('Blockchain revoke error:', error);
      throw new Error('Failed to revoke certificate on blockchain');
    }
  }

  async verifyCertificate(certHash: string): Promise<{
    isValid: boolean;
    ipfsCid: string;
    issuer: string;
    issuedAt: number;
    isExpired: boolean;
    isRevoked: boolean;
  }> {
    try {
      if (!this.contract) {
        throw new Error('Contract not configured');
      }

      const certHashBytes = ethers.id(certHash);
      const result = await this.contract.verifyCertificate(certHashBytes);

      return {
        isValid: result.isValid,
        ipfsCid: result.ipfsCid,
        issuer: result.issuer,
        issuedAt: Number(result.issuedAt),
        isExpired: result.isExpired,
        isRevoked: result.isRevoked,
      };
    } catch (error) {
      logger.error('Blockchain verify error:', error);
      throw new Error('Failed to verify certificate on blockchain');
    }
  }

  async getCertificate(certHash: string): Promise<any> {
    try {
      if (!this.contract) {
        throw new Error('Contract not configured');
      }

      const certHashBytes = ethers.id(certHash);
      const cert = await this.contract.getCertificate(certHashBytes);

      return {
        certHash: cert.certHash,
        ipfsCid: cert.ipfsCid,
        issuer: cert.issuer,
        issuedAt: Number(cert.issuedAt),
        expiryDate: Number(cert.expiryDate),
        isRevoked: cert.isRevoked,
        issuerDid: cert.issuerDid,
      };
    } catch (error) {
      logger.error('Blockchain get certificate error:', error);
      throw new Error('Failed to get certificate from blockchain');
    }
  }

  async authorizeIssuer(address: string, name: string, did: string): Promise<string> {
    try {
      if (!this.contract) {
        throw new Error('Contract not configured');
      }

      const tx = await this.contract.authorizeIssuer(address, name, did);
      const receipt = await tx.wait();

      logger.info(`Issuer authorized on blockchain: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error('Blockchain authorize issuer error:', error);
      throw new Error('Failed to authorize issuer on blockchain');
    }
  }

  async getBlockNumber(): Promise<number> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber;
    } catch (error) {
      logger.error('Failed to get block number:', error);
      return 0;
    }
  }

  async getTransactionReceipt(txHash: string): Promise<any> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      logger.error('Failed to get transaction receipt:', error);
      return null;
    }
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getWalletAddress(): string {
    return this.wallet.address;
  }
}

let blockchainService: BlockchainService;

export async function initializeBlockchain(): Promise<void> {
  try {
    blockchainService = new BlockchainService();
    const blockNumber = await blockchainService.getBlockNumber();
    logger.info(`Blockchain connected at block ${blockNumber}`);
    logger.info(`Wallet address: ${blockchainService.getWalletAddress()}`);

    if (blockchainService.getContractAddress()) {
      logger.info(`Contract address: ${blockchainService.getContractAddress()}`);
    } else {
      logger.warn('No contract address configured');
    }
  } catch (error) {
    logger.error('Failed to initialize blockchain:', error);
    throw error;
  }
}

export { blockchainService };
export default BlockchainService;