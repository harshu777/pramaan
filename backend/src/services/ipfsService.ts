import pinataSDK from '@pinata/sdk';
import { logger } from '../utils/logger';

interface IPFSService {
  uploadJSON(data: any): Promise<string>;
  getJSON(cid: string): Promise<any>;
  pin(cid: string): Promise<boolean>;
}

class MockIPFSService implements IPFSService {
  private storage: Map<string, any> = new Map();
  private static instance: MockIPFSService;

  constructor() {
    if (MockIPFSService.instance) {
      return MockIPFSService.instance;
    }
    MockIPFSService.instance = this;
  }

  async uploadJSON(data: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(data);
      const cid = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      this.storage.set(cid, data);
      logger.info(`Uploaded to Mock IPFS: ${cid}`);
      return cid;
    } catch (error) {
      logger.error('Mock IPFS upload error:', error);
      throw new Error('Failed to upload to Mock IPFS');
    }
  }

  async getJSON(cid: string): Promise<any> {
    try {
      const data = this.storage.get(cid);
      if (!data) {
        // Return mock verification data for development
        logger.debug('Mock IPFS: Returning placeholder data for CID:', cid);
        return {
          verified: true,
          cid: cid,
          timestamp: Date.now(),
          mock: true
        };
      }
      return data;
    } catch (error) {
      logger.error('Mock IPFS retrieval error:', error);
      // Return mock data even on error for development
      return {
        verified: true,
        cid: cid,
        timestamp: Date.now(),
        mock: true
      };
    }
  }

  async pin(cid: string): Promise<boolean> {
    logger.info(`Pinned CID (mock): ${cid}`);
    return true;
  }
}

class PinataService implements IPFSService {
  private pinata: any;

  constructor() {
    const apiKey = process.env.PINATA_API_KEY;
    const secretKey = process.env.PINATA_SECRET_KEY;

    if (!apiKey || !secretKey) {
      throw new Error('Pinata credentials not configured');
    }

    this.pinata = new pinataSDK(apiKey, secretKey);
  }

  async uploadJSON(data: any): Promise<string> {
    try {
      const options = {
        pinataMetadata: {
          name: `certificate-${Date.now()}`,
        },
        pinataOptions: {
          cidVersion: 0,
        },
      };

      const result = await this.pinata.pinJSONToIPFS(data, options);
      logger.info(`Uploaded to Pinata: ${result.IpfsHash}`);
      return result.IpfsHash;
    } catch (error) {
      logger.error('Pinata upload error:', error);
      throw new Error('Failed to upload to Pinata');
    }
  }

  async getJSON(cid: string): Promise<any> {
    try {
      const gateway = `https://gateway.pinata.cloud/ipfs/${cid}`;
      const response = await fetch(gateway);

      if (!response.ok) {
        throw new Error('Failed to fetch from Pinata');
      }

      return await response.json();
    } catch (error) {
      logger.error('Pinata retrieval error:', error);
      throw new Error('Failed to retrieve from Pinata');
    }
  }

  async pin(cid: string): Promise<boolean> {
    try {
      await this.pinata.pinByHash(cid);
      logger.info(`Pinned on Pinata: ${cid}`);
      return true;
    } catch (error) {
      logger.error('Pinata pin error:', error);
      return false;
    }
  }
}

class Web3StorageService implements IPFSService {
  private token: string;

  constructor() {
    const token = process.env.WEB3_STORAGE_TOKEN;
    if (!token) {
      throw new Error('Web3.Storage token not configured');
    }
    this.token = token;
  }

  async uploadJSON(data: any): Promise<string> {
    try {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const file = new File([blob], 'certificate.json');

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://api.web3.storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload to Web3.Storage');
      }

      const result: any = await response.json();
      logger.info(`Uploaded to Web3.Storage: ${result.cid}`);
      return result.cid;
    } catch (error) {
      logger.error('Web3.Storage upload error:', error);
      throw new Error('Failed to upload to Web3.Storage');
    }
  }

  async getJSON(cid: string): Promise<any> {
    try {
      const gateway = `https://w3s.link/ipfs/${cid}`;
      const response = await fetch(gateway);

      if (!response.ok) {
        throw new Error('Failed to fetch from Web3.Storage');
      }

      return await response.json();
    } catch (error) {
      logger.error('Web3.Storage retrieval error:', error);
      throw new Error('Failed to retrieve from Web3.Storage');
    }
  }

  async pin(cid: string): Promise<boolean> {
    logger.info(`Web3.Storage automatically pins content: ${cid}`);
    return true;
  }
}

export function createIPFSService(): IPFSService {
  if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
    logger.info('Using Pinata for IPFS storage');
    return new PinataService();
  } else if (process.env.WEB3_STORAGE_TOKEN) {
    logger.info('Using Web3.Storage for IPFS storage');
    return new Web3StorageService();
  } else {
    logger.info('Using Mock IPFS storage (development mode)');
    return new MockIPFSService();
  }
}

export const ipfsService = createIPFSService();